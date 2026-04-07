"use strict";
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = nodeCrawl;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const constants_1 = __importDefault(require("../../constants"));
const RootPathUtils_1 = require("../../lib/RootPathUtils");
function find(roots, extensions, ignore, includeSymlinks, rootDir, console, callback) {
    const result = new Map();
    let activeCalls = 0;
    const pathUtils = new RootPathUtils_1.RootPathUtils(rootDir);
    const visited = new Set();
    const exts = extensions.reduce((acc, ext) => {
        acc[ext] = true;
        return acc;
    }, {});
    function search(directory) {
        if (visited.has(directory)) {
            return;
        }
        else {
            visited.add(directory);
        }
        activeCalls++;
        fs.readdir(directory, { withFileTypes: true }, (err, entries) => {
            activeCalls--;
            if (err) {
                console.warn(`Error "${err.code ?? err.message}" reading contents of "${directory}", skipping. Add this directory to your ignore list to exclude it.`);
            }
            else {
                for (let idx = 0; idx < entries.length; idx++) {
                    const entry = entries[idx];
                    const file = path.join(directory, entry.name.toString());
                    if (ignore(file) || (!includeSymlinks && entry.isSymbolicLink())) {
                        continue;
                    }
                    else if (entry.isDirectory()) {
                        search(file);
                        continue;
                    }
                    activeCalls++;
                    fs.lstat(file, (err, stat) => {
                        activeCalls--;
                        if (!err && stat) {
                            const ext = path.extname(file).slice(1);
                            if (stat.isSymbolicLink() || exts[ext]) {
                                result.set(pathUtils.absoluteToNormal(file), [
                                    stat.mtime.getTime(),
                                    stat.size,
                                    0,
                                    null,
                                    stat.isSymbolicLink() ? 1 : 0,
                                    null,
                                ]);
                            }
                        }
                        if (activeCalls === 0) {
                            callback(result);
                        }
                    });
                }
            }
            if (activeCalls === 0) {
                callback(result);
            }
        });
    }
    if (roots.length > 0) {
        roots.forEach(search);
    }
    else {
        callback(result);
    }
}
function findWithoutStat(roots, extensions, ignore, includeSymlinks, rootDir, console, callback) {
    const result = new Map();
    let activeCalls = 0;
    const pathUtils = new RootPathUtils_1.RootPathUtils(rootDir);
    const visited = new Set();
    const exts = extensions.reduce((acc, ext) => {
        acc[ext] = true;
        return acc;
    }, {});
    function search(directory, dirNormal) {
        if (visited.has(directory)) {
            return;
        }
        visited.add(directory);
        activeCalls++;
        fs.readdir(directory, { withFileTypes: true }, (err, entries) => {
            activeCalls--;
            if (err) {
                console.warn(`Error "${err.code ?? err.message}" reading contents of "${directory}", skipping. Add this directory to your ignore list to exclude it.`);
            }
            else {
                for (let idx = 0; idx < entries.length; idx++) {
                    const entry = entries[idx];
                    const name = entry.name.toString();
                    const file = directory + path.sep + name;
                    if (ignore(file) || (!includeSymlinks && entry.isSymbolicLink())) {
                        continue;
                    }
                    // Build the normal path incrementally — avoids calling
                    // absoluteToNormal per file.
                    const fileNormal = dirNormal === '' ? name : dirNormal + path.sep + name;
                    if (entry.isDirectory()) {
                        search(file, fileNormal);
                        continue;
                    }
                    const isSymlink = entry.isSymbolicLink();
                    const ext = path.extname(name).slice(1);
                    if (isSymlink || exts[ext]) {
                        result.set(fileNormal, [
                            null, // deferred to getDifference
                            0, // unknown
                            0,
                            null,
                            isSymlink ? 1 : 0,
                            null,
                        ]);
                    }
                }
            }
            if (activeCalls === 0) {
                callback(result);
            }
        });
    }
    if (roots.length > 0) {
        roots.forEach((root) => search(root, pathUtils.absoluteToNormal(root)));
    }
    else {
        callback(result);
    }
}
async function asyncStatKnownFiles(fileData, previousFileSystem, rootDir) {
    const pathUtils = new RootPathUtils_1.RootPathUtils(rootDir);
    const promises = [];
    const externalPrefix = '..' + path.sep;
    for (const [normalPath, metadata] of fileData) {
        if (metadata[constants_1.default.SYMLINK] !== 0) {
            continue;
        }
        else if (metadata[constants_1.default.MTIME] != null && metadata[constants_1.default.MTIME] > 0) {
            continue;
        }
        else if (normalPath.startsWith(externalPrefix)) {
            // Skip reading mtime for files outside of project root
            continue;
        }
        const absolutePath = pathUtils.normalToAbsolute(normalPath);
        if (!previousFileSystem.exists(absolutePath)) {
            continue;
        }
        promises.push(fs.promises.lstat(absolutePath).then((stat) => {
            metadata[constants_1.default.MTIME] = stat.mtime.getTime();
            metadata[constants_1.default.SIZE] = stat.size;
        }, () => {
            fileData.delete(normalPath);
        }));
    }
    await Promise.all(promises);
}
async function nodeCrawl(options) {
    const { console, previousState, extensions, ignore, rootDir, includeSymlinks, perfLogger, roots, skipStat, abortSignal, subpath, } = options;
    abortSignal?.throwIfAborted();
    perfLogger?.point('nodeCrawl_start');
    const crawlFn = skipStat ? findWithoutStat : find;
    // (1): Discover files
    const fileData = await new Promise((resolve) => {
        crawlFn(roots, extensions, ignore, includeSymlinks, rootDir, console, resolve);
    });
    perfLogger?.point('nodeCrawl_afterCrawl');
    abortSignal?.throwIfAborted();
    // (2): Async stat for files that exist in the previous filesystem.
    if (skipStat) {
        await asyncStatKnownFiles(fileData, previousState.fileSystem, rootDir);
        perfLogger?.point('nodeCrawl_afterStat');
        abortSignal?.throwIfAborted();
    }
    const difference = previousState.fileSystem.getDifference(fileData, {
        subpath,
    });
    perfLogger?.point('nodeCrawl_end');
    return difference;
}
