// map keys code to key
var keyMap = {
    8: "backspace",
    9: "tab",
    13: "enter",
    16: "shift",
    17: "ctrl",
    18: "alt",
    19: "pause/break",
    20: "caps lock",
    27: "escape",
    33: "page up",
    34: "page down",
    35: "end",
    36: "home",
    37: "left arrow",
    38: "up arrow",
    39: "right arrow",
    40: "down arrow",
    45: "insert",
    46: "delete",
    48: "0",
    49: "1",
    50: "2",
    51: "3",
    52: "4",
    53: "5",
    54: "6",
    55: "7",
    56: "8",
    57: "9",
    65: "a",
    66: "b",
    67: "c",
    68: "d",
    69: "e",
    70: "f",
    71: "g",
    72: "h",
    73: "i",
    74: "j",
    75: "k",
    76: "l",
    77: "m",
    78: "n",
    79: "o",
    80: "p",
    81: "q",
    82: "r",
    83: "s",
    84: "t",
    85: "u",
    86: "v",
    87: "w",
    88: "x",
    89: "y",
    90: "z",
    91: "left window key",
    92: "right window key",
    93: "select key",
    96: "numpad 0",
    97: "numpad 1",
    98: "numpad 2",
    99: "numpad 3",
    100: "numpad 4",
    101: "numpad 5",
    102: "numpad 6",
    103: "numpad 7",
    104: "numpad 8",
    105: "numpad 9",
    106: "multiply",
    107: "add",
    109: "subtract",
    110: "decimal point",
    111: "divide",
    112: "f1",
    113: "f2",
    114: "f3",
    115: "f4",
    116: "f5",
    117: "f6",
    118: "f7",
    119: "f8",
    120: "f9",
    121: "f10",
    122: "f11",
    123: "f12",
    144: "num lock",
    145: "scroll lock",
    186: "semi-colon",
    187: "equal sign",
    188: "comma",
    189: "dash",
    190: "period",
    191: "forward slash",
    192: "grave accent",
    219: "open bracket",
    220: "back slash",
    221: "close braket",
    222: "single quote"
};

// options
var options = {};
var isPressDown = false;

// prevent default backspace, return and escape
function preventDefault() {
    var rx = /INPUT|SELECT|TEXTAREA/i;
    $(document).bind("keydown keypress", function (e) {
        if (e.which == 8 || e.which == 13 || e.which == 27) { // 8 == backspace
            if (!rx.test(e.target.tagName) || e.target.disabled || e.target.readOnly) {
                e.preventDefault();
            }
        }
    });
}

// release event to default behavior
function releaseDefault() {
    $(document).unbind("keydown");
    $(document).unbind("keypress");
}

// current active
var isActive = false;
var isShiftDown = false;

// handler for keydown evetn
$(document).keydown(function (event) {
    // is active
    if (isActive) {
        // escape key
        if (event.keyCode == 27) {
            // exit
            removeDiv();
        }

        // enter key
        if (event.keyCode == 13) {
            var url = 'http://' + $('#full-url-input').val();
            var destination = '';
            if (validUrl(url)) {
                destination = url;
            } else {
                destination = 'http://google.com/search?q=' + $('#full-url-input').val();
            }
            var win = window.open(destination, '_blank');
            win.focus();
            
            // remove after enter
            removeDiv();
        }
    // not active, check if is combination
    } else {
        // if current keydown
        if (!isPressDown) {
            isPressDown = true;
            cleanOptions();
        }
        // set key in options is true if key exists in keymap and options
        if (event.keyCode in options && event.keyCode in keyMap) {
            // set the key is true
            options[event.keyCode] = true;

            // check if all key in options is pressed
            var allTrue = true;
            for (key in options) {
                allTrue = allTrue && options[key];
            }

            // set active
            if (allTrue) {
                addDiv();
            }
        }
    }
    console.log('%c' + `${isActive}/${isShiftDown} ${event.keyCode}`,
        'background: red; color: white; font-size: 12px; font-weight: bold; padding: 3px;');
});

// handler for keyup
$(document).keyup(function (event) {
    isPressDown = false;
});

// add div at bot for enter URL
function addDiv() {
    isActive = true;
    preventDefault();
    var $div = $("<div>")
        .attr("class", "full-url")
        .append("<span>http://</span><input id='full-url-input' place-holder='abc.xyz...' />");
    setTimeout(function () {
        $('#full-url-input').focus();
    }, 1);
    $(document.body).append($div);
}

// remove div at bot for enter URL
function removeDiv() {
    isActive = false;
    $('#full-url-input').val('');
    //releaseDefault();
    $(".full-url").remove();
}

// check valid URL
function validUrl(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    if (!pattern.test(str)) {
        return false;
    } else {
        return true;
    }
}

// restore options
function restoreOption() {
    chrome.storage.sync.get({
        keys: {}
    }, function (data) {
        options = data.keys;
        if ($.isEmptyObject(options)){
            options = {191: true};
        }
        //cleanOptions();
    });
}

// clean all options to false
function cleanOptions() {
    for (key in options) {
        options[key] = false;
    }
}

(function () {
    restoreOption();
})();