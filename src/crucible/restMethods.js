"use strict";

var util = require("util");
var querystring = require("querystring");

var config = require("config").Crucible;
var httpStatus = require("http-status");
var Client = require("node-rest-client").Client;

var client = new Client();

client.registerMethod("login", util.format("%s/rest-service/auth-v1/login", config.url), "POST");
client.registerMethod("getOpenReviews", util.format("%s/rest-service/reviews-v1/filter/toReview", config.url), "GET");
client.registerMethod("getReviewItems", util.format("%s/rest-service/reviews-v1/${id}/reviewitems", config.url), "GET");
client.registerMethod("getFileContents", util.format("%s/${path}", config.url), "GET");
client.registerMethod("postComment", util.format("%s/rest-service/reviews-v1/${id}/reviewitems/${riId}/comments", config.url), "POST");
client.registerMethod("markReviewAsComplete", util.format("%s/rest-service/reviews-v1/${id}/complete", config.url), "POST");

var TOKEN;
var COOKIE;

/**
 * @typedef {Function} loginCallback
 * @param {Boolean} loginSuccessful determines whether login request was successful
 */

/**
 * Tries to login to Crucible instance using credentials specified in configuration
 *
 * @param {loginCallback} loginCallback
 */
exports.login = function (loginCallback) {
    var args = {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
        },
        data: querystring.stringify({
            userName: config.credentials.username,
            password: config.credentials.password
        })
    };

    client.methods.login(args, function (data, res) {
        if (res.statusCode !== httpStatus.OK || typeof(data) !== "object") {
            loginCallback(false);
            return;
        }

        TOKEN = data.token;
        COOKIE = res.headers["set-cookie"];

        loginCallback(true);
    });
};

/**
 * @typedef {Function} defaultCallback
 * @param {Error} err               an instance of Error object if operation failed, null otherwise
 * @param {Object | String} data    data retrieved by the request
 * @param {Object} res              response object
 */

/**
 * Retrieves details of reviews that the bot user is a participant in and that are not marked as complete
 *
 * @param {defaultCallback} getOpenReviewsCallback
 */
exports.getOpenReviews = function (getOpenReviewsCallback) {
    var args = {
        headers: {
            Accept: "application/json"
        },
        parameters: {
            FEAUTH: TOKEN
        }
    };

    client.methods.getOpenReviews(args, function (data, res) {
        if (res.statusCode !== httpStatus.OK || typeof(data) !== "object") {
            getOpenReviewsCallback(new Error("Failed to retrieve open reviews"));
            return;
        }

        getOpenReviewsCallback(null, data, res);
    });
};

/**
 * Retrieves details of review items in a given review
 *
 * @param {String} reviewId review ID for which to retrieve review items
 * @param {defaultCallback} getReviewItemsCallback
 */
exports.getReviewItems = function (reviewId, getReviewItemsCallback) {
    var args = {
        path: {
            id: reviewId
        },
        headers: {
            Accept: "application/json"
        },
        parameters: {
            FEAUTH: TOKEN
        }
    };

    client.methods.getReviewItems(args, function (data, res) {
        if (res.statusCode !== httpStatus.OK || typeof(data) !== "object") {
            getReviewItemsCallback(new Error(util.format("Failed to retrieve review items for review %s", reviewId)));
            return;
        }

        getReviewItemsCallback(null, data, res);
    });
};

/**
 * Retrieves contents of a file stored on Crucible instance
 *
 * @param {String} path path to the file
 * @param {defaultCallback} getFileContentsCallback
 */
exports.getFileContents = function (path, getFileContentsCallback) {
    var args = {
        headers: {
            cookie: COOKIE
        }
    };

    client.get(util.format("%s%s", config.url, path), args, function (data, res) {
        if (res.statusCode !== httpStatus.OK) {
            getFileContentsCallback(new Error(util.format("Failed to retrieve file contents for path: %s", path)));
            return;
        }

        getFileContentsCallback(null, data, res);
    });
};

/**
 * Posts a comment on a line of a review item
 *
 * @param {String} reviewId            review ID containing the review item
 * @param {string} reviewItemId        review item ID in which to post the comment
 * @param {String | Number} revision   revision of the review item that the comment should be posted in
 * @param {String | Number}            line line on which the comment should be posted
 * @param {String} message             message to post
 * @param {defaultCallback} postCommentCallback
 */
exports.postComment = function (reviewId, reviewItemId, revision, line, message, postCommentCallback) {
    var args = {
        path: {
            id: reviewId,
            riId: reviewItemId
        },
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        parameters: {
            FEAUTH: TOKEN
        },
        data: JSON.stringify({
            message: message,
            lineRanges: [
                {
                    revision: revision.toString(),
                    range: line.toString()
                }
            ]
        })
    };

    client.methods.postComment(args, function (data, res) {
        if (res.statusCode !== httpStatus.CREATED || typeof(data) !== "object") {
            postCommentCallback(new Error(util.format("Failed to post comment on item %s in review", reviewItemId, reviewId)));
            return;
        }

        postCommentCallback(null, data, res);
    });
};

/**
 * Marks the given review as complete
 *
 * @param {String} reviewId ID of the review to mark as complete
 * @param {defaultCallback} markReviewAsCompleteCallback
 */
exports.markReviewAsComplete = function (reviewId, markReviewAsCompleteCallback) {
    var args = {
        path: {
            id: reviewId
        },
        parameters: {
            FEAUTH: TOKEN
        }
    };

    client.methods.markReviewAsComplete(args, function (data, res) {
        if (res.statusCode !== httpStatus.NO_CONTENT) {
            markReviewAsCompleteCallback(new Error(util.format("Failed to mark review %s as complete", reviewId)));
            return;
        }

        markReviewAsCompleteCallback(null, data, res);
    });
};