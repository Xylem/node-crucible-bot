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
            var reviewKeys = reviewsData.reviewData.map(function (review) {
                return review.permaId.id;
            });

            getOpenReviewsCallback(null, reviewKeys);
        });
    },
    function getReviewItems(reviewKeys, getReviewItemsCallback) {
        async.map(reviewKeys, crucible.getReviewItems, function (err, reviewItemsArray) {
            var items = {};

            reviewItemsArray = reviewItemsArray.map(function (reviewItems) {
                return reviewItems.reviewItem.filter(function (reviewItem) {
                    var lastRevision = reviewItem.expandedRevisions[reviewItem.expandedRevisions.length - 1];

                    return lastRevision.fileType === "File" && (lastRevision.commitType === "Modified" || lastRevision.commitType === "Added");
                }).map(function (reviewItem) {
                        var lastRevision = reviewItem.expandedRevisions[reviewItem.expandedRevisions.length - 1];

                        return {
                            id: reviewItem.permId.id,
                            revision: lastRevision.revision,
                            path: lastRevision.contentUrl
                        };
                    });
            });

            for (var i = 0; i < reviewKeys.length; ++i) {
                items[reviewKeys[i]] = reviewItemsArray[i];
            }

            getReviewItemsCallback(null, items);
        });
    },
    function getFileContents(reviews, getFileContentsCallback) {
        async.each(Object.keys(reviews), function (reviewKey, reviewsMapCallback) {
            var review = reviews[reviewKey];

            //TODO check all validators
            review = review.filter(function (reviewItem) {
                return jshint.supportedFiletypes.indexOf(path.extname(reviewItem.path)) !== -1;
            });

            async.map(review, function (reviewItem, mapCallback) {
                crucible.getFileContents(reviewItem.path, mapCallback);
            }, function (err, result) {
                for (var i = 0; i < result.length; ++i) {
                    reviews[reviewKey][i].file = result[i];
                }

                reviewsMapCallback(err, review);
            });
        }, function (err) {
            getFileContentsCallback(err, reviews);
        });
    },
    function validateAndPostComments(reviews, validateAndPostCommentsCallback) {
        async.each(Object.keys(reviews), function (reviewKey, reviewsEachCallback) {
            var review = reviews[reviewKey];

            //TODO validate with all available validators
            async.each(review, function (reviewItem, eachCallback) {
                var errors = jshint.validate(reviewItem.file);

                async.each(errors, function (error, postCommentDone) {
                    crucible.postComment(reviewKey, reviewItem.id, reviewItem.revision, error.line, error.message, postCommentDone)
                }, function (err) {
                    eachCallback(err);
                });
            }, function (err) {
                reviewsEachCallback(err);
            });
        }, function (err) {
            validateAndPostCommentsCallback(err);
        });
    }
], function (err, result) {

});