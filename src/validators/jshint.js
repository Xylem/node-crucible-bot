"use strict";

var fs = require("fs");
var jshint = require("jshint").JSHINT;
var config = JSON.parse(fs.readFileSync("./config/.jshintrc"));

exports.supportedFiletypes = [ ".js" ];

exports.validate = function (fileContents) {
    if (!jshint(fileContents, config, {})) {
        return jshint.errors.filter(function (error) {
            return error;
        }).map(function (error) {
            return {
                line: error.line,
                message: error.reason
            };
        });
    } else {
        return [];
    }
};