{
    "name": "Betexy Bot",
    "description": "#VERSION#",
    "background": {
        "scripts": [
            "settings.js",#TENNISI_BACKGROUND#
            "libs/jquery-3.3.1.min.js",
            "libs/helper.js",
            "libs/blockers.js",
            "libs/injects.js",
            "libs/common.js",
            "libs/mainCycle.js",#SODIUM#
            "js/#LOGIC_NAME#.js"
        ]
    },
    "content_scripts": [
        {
            "all_frames": true,
            "js": [
                "libs/jquery-3.3.1.min.js",
                "libs/helper.js",
                "libs/staticcache.js"
            ],
            "matches": [
                "*://*.staticcache.org/*",
                "*://*.scoreboards.red7mobile.com/*"
            ]
        },
        {
            "all_frames": true,
            "js": [
                "libs/jquery-3.3.1.min.js",
                "libs/html2canvas.min.js",
                "libs/helper.js",
                "libs/recaptcha.js"
            ],
            "matches": [
                "https://www.google.com/recaptcha/api2/*"
            ]
        },
        {
            "all_frames": true,
            "js": [
                "libs/jquery-3.3.1.min.js",
                "libs/js.cookie.min.js",
                "libs/helper.js",
                "js/safecharge.js"
            ],
            "matches": [
                "https://secure.safecharge.com/*"
            ]
        },
        {
            "all_frames": true,
            "js": [
                "libs/ymBlock.js",
                "js/contentScriptCheck.js"
            ],
            "matches": [
                "*://*/*"
            ]#DOCUMENT_START#
        }
        #INCLUDE_JS_FOR#
#CONTENT_SCRIPTS#
    ],
    "permissions": [
        "storage",
        "tabs",
        "activeTab",
        "nativeMessaging",
        "<all_urls>",
        "management",
        "http://*/*",
        "https://*/*",
        "webRequest",
        "webRequestBlocking",
        "webNavigation",
        "notifications",
        "debugger",
        "clipboardRead"
    ],
    "content_security_policy": "script-src 'self' 'unsafe-eval'; object-src 'self'",
    "web_accessible_resources": [
        #DIRECT_RESOURCES#
    ],
    "manifest_version": 2,
    "version": "2.0",
    "icons": {
        "128": "icon.png"
    },
    "browser_action": {
        "default_popup": "options.html"
    }
}
