"use strict";

var util = require("util");
var querystring = require("querystring");

var config = require("config").Crucible;
var httpStatus = require("http-status");
var Client = require("node-rest-client").Client;

var client = new Client();

client.registerMethod("login", util.format("%s/rest-service/auth-v1/login", config.url), "POST");

client.registerMethod("getOpenReviews", util.format("%s/rest-service/reviews-v1/filter/allOpenReviews", config.url), "GET");

client.registerMethod("getReviewItems", util.format("%s/rest-service/reviews-v1/${id}/reviewitems", config.url), "GET");

client.registerMethod("getFileContents", util.format("%s/${path}", config.url), "GET");

client.registerMethod("postComment", util.format("%s/rest-service/reviews-v1/${id}/reviewitems/${riId}/comments", config.url), "POST");

var TOKEN;
var COOKIE;

/**
 * Tries to login to Crucible instance using credentials specified in configuration
 *
 * @param {Function} loginCallback called upon finishing login request
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
        if (res.statusCode === httpStatus.OK) {
            TOKEN = data.token;
            COOKIE = res.headers["set-cookie"];

            loginCallback(true);
        } else {
            loginCallback(false);
        }
    });
};

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
        getOpenReviewsCallback(null, data, res);
    });
};

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
        getReviewItemsCallback(null, data, res);
    });
};

exports.getFileContents = function (path, getFileContentsCallback) {
    var args = {
        headers: {
            cookie: COOKIE
        }
    };

    client.get(util.format("%s%s", config.url, path), args, function (data) {
        getFileContentsCallback(null, data);
    });
};

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
        postCommentCallback(null, data, res);
    });
};