var lastDate = null;
var apiToken = null;

function updateMode(isSelectorMode) {
    var dateSelector = document.getElementById('dateSelector');
    var timeSelector = document.getElementById('timeSelector');
    var modeSelector = document.getElementById('modeSelector');
    var prevButton = document.getElementById('prevButton');
    var nextButton = document.getElementById('nextButton');
    var modeLabel = document.getElementById('modeLabel');
    var stepsSelector = document.getElementById('stepsSelector');


    if (isSelectorMode) {
        dateSelector.disabled = false;
        timeSelector.disabled = false;

        prevButton.disabled = true;
        nextButton.disabled = true;

        modeLabel.innerHTML = 'Mode: Select';

        stepsSelector.disabled = true;
    } else {
        dateSelector.disabled = true;
        timeSelector.disabled = true;

        prevButton.disabled = false;
        nextButton.disabled = false;

        stepsSelector.disabled = false;

        modeLabel.innerHTML = 'Mode: Step';

        var now = new Date(Date.now());

        var h = now.getHours();
        var m = now.getMinutes();

        if (h < 10) {
            h = '0' + h;
        }

        if (m < 10) {
            m = '0' + m;
        }

        var currentTime = h + ":" + m;
        dateSelector.valueAsDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
        timeSelector.value = currentTime;
    }
}

function compare(a, b) {
    const bandA = a.key.toUpperCase();
    const bandB = b.key.toUpperCase();

    let comparison = 0;
    if (bandA > bandB) {
        comparison = 1;
    } else if (bandA < bandB) {
        comparison = -1;
    }
    return comparison;
}

async function get(url) {
    const response = await fetch(url, {
        method: 'GET'
    });
    return response.json();
}

function getEpochSeconds(dateValue, timeValue) {
    var offset = new Date().getTimezoneOffset();

    var d = new Date(parseInt(dateValue.slice(0, 4)), parseInt(dateValue.slice(5, 7)) - 1, parseInt(dateValue.slice(8, 10)), parseInt(timeValue.slice(0, 2)), parseInt(timeValue.slice(3, 5)), 0);

    return d.getTime() / 1000;
}


async function fetchTracksAfter(user, date, num) {
    var from = date;
    var to = date + (86400 * 3);

    tracks = await fetchTracks(user, from, to, null);
    if (tracks.hasOwnProperty('error')) {
        return [];
    }

    if (tracks.recenttracks["@attr"].total < num) {
        to = null;
        tracks = await fetchTracks(user, from, to, null);
        if (tracks.hasOwnProperty('error')) {
            return [];
        }
    }

    var page = tracks.recenttracks["@attr"].page;
    var totalPages = tracks.recenttracks["@attr"].totalPages;
    var result = [];

    if (totalPages == 0) {
        return [];
    }

    if (totalPages == 1) {
        result = tracks.recenttracks.track;
    } else {
        tracks = await fetchTracks(user, from, to, totalPages);
        if (tracks.hasOwnProperty('error')) {
            return [];
        }

        result = tracks.recenttracks.track;

        if (result.length < num) {
            var pom = await fetchTracks(user, from, to, totalPages - 1);
            if (!tracks.hasOwnProperty('error')) {
                result = pom.concat(result.recenttracks.track);
            }
        }
    }

    var result_filtered = [];

    for (let index of result.reverse()) {
        if (index.hasOwnProperty("@attr") && index["@attr"].nowplaying == "true") {
            continue;
        }

        result_filtered.push(index);

        if (result_filtered.length >= num) {
            return result_filtered.reverse();
        }
    }

    return result_filtered.reverse();
}

async function fetchTracksBefore(user, date, num) {
    var to = date;
    var from = date - (86400 * 3);

    tracks = await fetchTracks(user, from, to, null);

    if (tracks.hasOwnProperty('error')) {
        return [];
    }

    if (tracks.recenttracks["@attr"].total < num) {
        from = null;
        tracks = await fetchTracks(user, from, to, null);
        if (tracks.hasOwnProperty('error')) {
            return [];
        }
    }

    result = [];

    if (tracks.recenttracks["@attr"].totalPages == 0) {
        return [];
    }

    for (let index of tracks.recenttracks.track) {
        if (index.hasOwnProperty("@attr") && index["@attr"].nowplaying == "true") {
            continue;
        }

        result.push(index);

        if (result.length >= num) {
            return result;
        }
    }

    return result;
}



async function fetchTracks(user, from, to, page) {
    if (user == null || user == '') {
        return {
            error: true,
            message: "Empty user name"
        };
    }

    var url = "https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=";
    url += user;
    url += "&api_key=" + apiToken;
    url += "&format=json&limit=200";



    if (from != null) {
        url += "&from=" + from;
    }

    if (to != null) {
        url += "&to=" + to;
    }

    if (page != null) {
        url += "&page=" + page;
    }

    return get(url);
}


async function getTracksAroundDate(user, date, num) {
    lastDate = date;

    if(user == null || user == '') {
        return;
    }

    var before = await fetchTracksBefore(user, date, num);
    var after = await fetchTracksAfter(user, date, num);

    return after.concat(before).reverse();
}

function createTile(track_object) {
    var songTile = document.createElement("div");
    songTile.classList.add("songTile");

    var songName = document.createElement("label");
    songName.classList.add("songName");
    songName.innerHTML = track_object.name;

    var songAuthor = document.createElement("label");
    songAuthor.classList.add("songAuthor");
    songAuthor.innerHTML = track_object.artist["#text"];

    var songDatetime = document.createElement("label");
    songDatetime.classList.add("songDatetime");
    songDatetime.innerHTML = new Date(parseInt(track_object.date.uts) * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });

    var songCover = document.createElement("img");
    songCover.classList.add("songCover");
    songCover.src = track_object.image[2]["#text"];

    songTile.appendChild(songName);
    songTile.appendChild(songAuthor);
    songTile.appendChild(songDatetime);
    songTile.appendChild(songCover);

    songTile.addEventListener('click', function() {
        chrome.tabs.create({
            'url': track_object.url
        });
    });


    return songTile;
}

function createDateDivider(dateString) {
    var dividerContainer = document.createElement("div");
    dividerContainer.classList.add("dividerContainer");

    var dividerLabel = document.createElement("label");
    dividerLabel.classList.add("dividerLabel");
    dividerLabel.innerHTML = dateString;

    var dividerLine = document.createElement("hr");
    dividerLine.classList.add("dividerLine");

    dividerContainer.appendChild(dividerLabel);
    dividerContainer.appendChild(dividerLine);

    return dividerContainer;
}

const removeChilds = (parent) => {
    while (parent.lastChild) {
        parent.removeChild(parent.lastChild);
    }
};

function fillInContent(data, epochSeconds) {
    if (data == null) {
        console.log("No data could be fetched from Last.fm API");
        return;
    }

    if (data.hasOwnProperty('error')) {
        console.log("No data could be fetched from Last.fm API: " + data.message);
        return;
    }

    if (lastDate != null && lastDate != epochSeconds) {
        return;
    }

    var result = [];
    var activeIndex = -1;
    var min_diff = epochSeconds;

    var contentSection = document.getElementById("contentSection");
    removeChilds(contentSection);

    var date = new Date(parseInt(data[0].date.uts) * 1000).toLocaleDateString([], {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        weekday: 'short'
    });
    contentSection.appendChild(createDateDivider(date));


    for (index = 0; index < data.length; index++) {
        var item = createTile(data[index]);
        result.push(item);

        var diff = Math.abs(data[index].date.uts - epochSeconds);

        if (Math.abs(data[index].date.uts - epochSeconds) < min_diff) {
            min_diff = diff;
            activeIndex = index;
        }

        var new_date = new Date(parseInt(data[index].date.uts) * 1000).toLocaleDateString([], {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            weekday: 'short'
        });
        if (new_date != date) {
            contentSection.appendChild(createDateDivider(new_date));
            date = new_date;
        }

        contentSection.appendChild(item);
    }

    if (activeIndex >= 0) {
        result[activeIndex].classList.add("activeSong");
    }
}


function updateTracks(dateValue, timeValue, user) {
    var epochSeconds = getEpochSeconds(dateValue, timeValue, user);
    getTracksAroundDate(user, epochSeconds, 3).then(data => {
        fillInContent(data, epochSeconds);
    });
}

function doAStep(direction, dateValue, timeValue, user) {
    var epochSeconds = getEpochSeconds(dateValue, timeValue, user);

    var dateInput = document.getElementById('dateSelector');
    var timeInput = document.getElementById('timeSelector');

    var date = new Date(epochSeconds * 1000);

    var stepSize = document.getElementById('stepsSelector').value;

    if (stepSize == 'hour') {
        date.setHours(date.getHours() + (direction * 1));
    } else if (stepSize == 'day') {
        date.setDate(date.getDate() + (direction * 1));
    } else if (stepSize == 'week') {
        date.setDate(date.getDate() + (direction * 7));
    } else if (stepSize == 'month') {
        date.setMonth(date.getMonth() + (direction * 1));
    } else {
        date.setFullYear(date.getFullYear() + (direction * 1));
    }


    getTracksAroundDate(user, date.getTime() / 1000, 3).then(data => {
        fillInContent(data, date.getTime() / 1000);
    });

    dateInput.valueAsDate = date;
    timeInput.value = date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
}


document.addEventListener('DOMContentLoaded', function() {

    fetch('../token.txt')
        .then(response => response.text())
        .then((data) => {
            apiToken = data;

            var fundButton = document.getElementById('fundMe');
            fundButton.addEventListener('click', function() {
                chrome.tabs.create({
                    'url': "https://www.linkedin.com/in/miroslav-matocha/"
                });
            });

            updateMode(false);

            var userInput = document.getElementById('userInput');
            var dateInput = document.getElementById('dateSelector');
            var timeInput = document.getElementById('timeSelector');
            var modeSelector = document.getElementById('modeCheckBox');
            var prevButton = document.getElementById('prevButton');
            var nextButton = document.getElementById('nextButton');
            var saveUser = document.getElementById('saveUser');

            chrome.storage.sync.get(['last_fm_user'], function(result) {
                if (result.last_fm_user != null) {
                    userInput.value = result.last_fm_user;
                }

                updateTracks(dateInput.value, timeInput.value, userInput.value);
            });


            modeSelector.addEventListener('click', function() {
                updateMode(modeSelector.checked);
                if (!modeSelector.checked) {
                    updateTracks(dateInput.value, timeInput.value, userInput.value);
                }
            });

            saveUser.addEventListener('click', function() {
                chrome.storage.sync.set({
                    "last_fm_user": userInput.value
                }, function() {
                    console.log('Saved user %o', userInput.value);
                    updateTracks(dateInput.value, timeInput.value, userInput.value);
                });
            });

            dateInput.addEventListener('change', function() {
                updateTracks(dateInput.value, timeInput.value, userInput.value);
            });

            timeInput.addEventListener('change', function() {
                updateTracks(dateInput.value, timeInput.value, userInput.value);
            });


            prevButton.addEventListener('click', function() {
                doAStep(-1, dateInput.value, timeInput.value, userInput.value);
            });

            nextButton.addEventListener('click', function() {
                doAStep(+1, dateInput.value, timeInput.value, userInput.value);
            });

        });



}, false);