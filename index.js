"use strict";

var path = require("path");
var async = require("async");
var crucible = require("./src/crucible/crucible");

//TODO change this to load all validators in the directory
var jshint = require("./src/validators/jshint");

async.waterfall([
    function login(loginCallback) {
        crucible.login(function (loginSuccessful) {
            if (loginSuccessful) {
                loginCallback()
            } else {
                loginCallback(new Error("Failed to login"));
            }
        });
    },
    function getOpenReviews(getOpenReviewsCallback) {
        crucible.getOpenReviews(function (err, reviewsData) {
            var reviewIds = reviewsData.reviewData.map(function (review) {
                return review.permaId.id;
            });

            getOpenReviewsCallback(null, reviewIds);
        });
    },
    function getReviewItems(reviewIds, getReviewItemsCallback) {
        var reviewItemsArray = [];

        async.each(reviewIds, function (reviewId, reviewItemsFetchedCallback) {
            crucible.getReviewItems(reviewId, function (err, reviewItems) {
                if (err) {
                    reviewItemsFetchedCallback(err);
                    return;
                }

                reviewItems.reviewItem.forEach(function (reviewItem) {
                    var lastRevision = reviewItem.expandedRevisions[reviewItem.expandedRevisions.length - 1];

                    if (lastRevision.fileType === "File" && (lastRevision.commitType === "Modified" || lastRevision.commitType === "Added" || lastRevision.commitType === "Moved")) {
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
    },
    function getFileContents(reviewItems, getFileContentsCallback) {
        reviewItems = reviewItems.filter(function (reviewItem) {
            return jshint.supportedFiletypes.indexOf(path.extname(reviewItem.path)) !== -1;
        });

        async.each(reviewItems, function (reviewItem, fileRetrievedCallback) {
            crucible.getFileContents(reviewItem.path, function (err, data) {
                reviewItem.file = data;

                fileRetrievedCallback(err);
            });
        }, function (err) {
            getFileContentsCallback(err, reviewItems);
        });
    },
    function validateAndPostComments(reviewItems, validateAndPostCommentsCallback) {
        //TODO validate with all available validators
        async.each(reviewItems, function (reviewItem, eachCallback) {
            var errors = jshint.validate(reviewItem.file);

            async.each(errors, function (error, postCommentDone) {
                crucible.postComment(reviewItem.reviewId, reviewItem.id, reviewItem.revision, error.line, error.message, postCommentDone)
            }, function (err) {
                eachCallback(err);
            });
        }, function (err) {
            validateAndPostCommentsCallback(err);
        });
    }
], function (err, result) {

});