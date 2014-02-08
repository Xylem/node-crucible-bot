"use strict";

var async = require("async");
var crucibleClient = require("./src/crucible/client");

var processedReviews = [];

async.waterfall([
    crucibleClient.login,
    function (getOpenReviewsCallback) {
        crucibleClient.getOpenReviews(function (err, reviewIds) {
            processedReviews = reviewIds;

            getOpenReviewsCallback(err, reviewIds);
        });
    },
    crucibleClient.getReviewItems,
    crucibleClient.getFileContents,
    crucibleClient.validateAndPostComments,
    function (markReviewsAsCompleteCallback) {
        crucibleClient.markReviewsAsComplete(processedReviews, markReviewsAsCompleteCallback);
    }
], function (err, result) {

});