"use strict";

var path = require("path");
var config = require("config").Crucible;
var async = require("async");
var restMethods = require("./restMethods");

//TODO change this to load all validators in the directory
var jshint = require("../validators/jshint");

var PROCESSED_COMMIT_TYPES = [ "Modified", "Added", "Moved" ];

/**
 * @typedef {Function} defaultCallback
 * @param {Error} err               an instance of Error object if operation failed, null otherwise
 * @param {Object | String} data    data retrieved by the request
 * @param {Object} res              response object
 */

/**
 * Tries to login to Crucible instance using credentials specified in configuration
 *
 * @param {defaultCallback} loginCallback
 */
exports.login = function (loginCallback) {
    restMethods.login(function (loginSuccessful) {
        if (loginSuccessful) {
            loginCallback();
        } else {
            loginCallback(new Error("Failed to login"));
        }
    });
};

/**
 * Retrieves an array of review IDs that the bot user is a participant in and that are not marked as complete
 *
 * @param {defaultCallback} getOpenReviewsCallback
 */
exports.getOpenReviews = function (getOpenReviewsCallback) {
    restMethods.getOpenReviews(function (err, reviewsData) {
        if (err) {
            getOpenReviewsCallback(err);
            return;
        }

        var reviewIds = reviewsData.reviewData.map(function (review) {
            return review.permaId.id;
        });

        getOpenReviewsCallback(null, reviewIds);
    });
};

/**
 * Retrieves an array of review items for all given reviews. Each retrieved review item is represented as an object with
 * properties `id`, `reviewId`, `revision` and `path`.
 *
 * @param {[String]} reviewIds array of review IDs for which to retrieve the review items
 * @param {defaultCallback} getReviewItemsCallback
 */
exports.getReviewItems = function (reviewIds, getReviewItemsCallback) {
    var reviewItemsArray = [];

    async.each(reviewIds, function (reviewId, reviewItemsFetchedCallback) {
        restMethods.getReviewItems(reviewId, function (err, reviewItems) {
            if (err) {
                reviewItemsFetchedCallback(err);
                return;
            }

            reviewItems.reviewItem.forEach(function (reviewItem) {
                var lastRevision = reviewItem.expandedRevisions[reviewItem.expandedRevisions.length - 1];

                if (lastRevision.fileType === "File" &&
                    PROCESSED_COMMIT_TYPES.indexOf(lastRevision.commitType) !== -1 &&
                    reviewItem.participants.some(function (participant) {
                        return !participant.completed && participant.user.userName === config.credentials.username;
                    })) {
                    reviewItemsArray.push({
                        id: reviewItem.permId.id,
                        reviewId: reviewId,
                        revision: lastRevision.revision,
                        path: lastRevision.contentUrl
                    });
                }
            });

            reviewItemsFetchedCallback();
        });
    }, function (err) {
        getReviewItemsCallback(err, reviewItemsArray);
    });
};

/**
 * @typedef {Object} reviewItem
 * @property {String} id          ID of the review item
 * @property {String} reviewId    ID of the review containing review item
 * @property {String} revision    latest revision of the review item in review
 * @property {String} path        path to contents of the revision of the review item
 */

/**
 * For a given array of review items, removes those that have no existing validator for a given file type and retrieves
 * the contents of the remaining files, adding `file` property to each review item with the retrieved data.
 *
 * @param {[reviewItem]} reviewItems
 * @param {defaultCallback} getFileContentsCallback
 */
exports.getFileContents = function (reviewItems, getFileContentsCallback) {
    reviewItems = reviewItems.filter(function (reviewItem) {
        return jshint.supportedFiletypes.indexOf(path.extname(reviewItem.path)) !== -1;
    });

    async.each(reviewItems, function (reviewItem, fileRetrievedCallback) {
        restMethods.getFileContents(reviewItem.path, function (err, data) {
            reviewItem.file = data;

            fileRetrievedCallback(err);
        });
    }, function (err) {
        getFileContentsCallback(err, reviewItems);
    });
};

/**
 * @typedef {Object} reviewItemWithContents
 * @property {String} id          ID of the review item
 * @property {String} reviewId    ID of the review containing review item
 * @property {String} revision    latest revision of the review item in review
 * @property {String} path        path to contents of the revision of the review item
 * @property {String} file        contents of the revision of the review item
 */

/**
 * Performs validation for each given review item and posts comments containing found issues
 *
 * @param {[reviewItemWithContents]} reviewItems array of review items with their contents retrieved
 * @param {defaultCallback} validateAndPostCommentsCallback
 */
exports.validateAndPostComments = function (reviewItems, validateAndPostCommentsCallback) {
    //TODO validate with all available validators
    async.each(reviewItems, function (reviewItem, eachCallback) {
        var errors = jshint.validate(reviewItem.file);

        async.each(errors, function (error, postCommentDone) {
            restMethods.postComment(reviewItem.reviewId, reviewItem.id, reviewItem.revision, error.line, error.message, postCommentDone)
        }, function (err) {
            eachCallback(err);
        });
    }, function (err) {
        validateAndPostCommentsCallback(err);
    });
};

/**
 * Marks given reviews as complete
 *
 * @param {[String]} reviewIds array of review IDs of reviews that should be marked as complete
 * @param {defaultCallback} markReviewsAsComplete
 */
exports.markReviewsAsComplete = function (reviewIds, markReviewsAsComplete) {
    async.each(reviewIds, restMethods.markReviewAsComplete, markReviewsAsComplete);
};