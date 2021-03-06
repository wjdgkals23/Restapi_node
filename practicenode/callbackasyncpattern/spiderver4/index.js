const request = require('request');
const fs = require('fs');
const mkdirp = require('mkdirp');
const path = require('path');
const utilities = require('./utilities');
const TaskQueue = require('./taskQueue');
let downloadQueue = new TaskQueue(3);

function spiderLinks(currentUrl, body, nesting, callback) {
    console.log("spiderLinks");
    if(nesting === 0) {
        return process.nextTick(callback);
    }

    const links = utilities.getPageLinks(currentUrl, body);
    if(links.length === 0) {
        return process.nextTick(callback);
    }

    let completed = 0, hasErrors = false;
    let that = this;
    links.forEach(link => {
        downloadQueue.pushTask(done => {
            let that1 = this;
            spider(link, nesting - 1, err => {
                if(err) {
                    hasErrors = true;
                    return callback(err);
                }
                // console.log(that === that1); spider의 콜백을 화살표함수로 작성했기때문에 해당 콜백의 this는 상위인 spiderLinks의 this값이 바인딩된다.
                // console.log(that1 === this);
                if(++completed === links.length && !hasErrors) {
                    callback();
                }
                done();
            });
        });
    });
}

function saveFile(filename, contents, callback) {
    mkdirp(path.dirname(filename), err => {
        if(err) {
            return callback(err);
        }
        fs.writeFile(filename, contents, callback);
    });
}

function download(url, filename, callback) {
    console.log(`Downloading ${url}`);
    request(url, (err, response, body) => {
        if(err) {
            return callback(err);
        }
        saveFile(filename, body, err => {
            if(err) {
                return callback(err);
            }
            console.log(`Downloaded and saved: ${url}`);
            callback(null, body);
        });
    });
}

let spidering = new Map();
function spider(url, nesting, callback) {
    if(spidering.has(url)) {
        return process.nextTick(callback);
    }
    spidering.set(url, true);

    const filename = utilities.urlToFilename(url);
    fs.readFile(filename, 'utf8', function(err, body) {
        if(err) {
            if(err.code !== 'ENOENT') {
                return callback(err);
            }

            return download(url, filename, function(err, body) {
                if(err) {
                    return callback(err);
                }
                spiderLinks(url, body, nesting, callback);
            });
        }
        spiderLinks(url, body, nesting, callback);
    });
}

spider(process.argv[2], 2, (err) => {
    if(err) {
        console.log(err);
        return process.exit();
    }
    console.log('Download complete');
});
