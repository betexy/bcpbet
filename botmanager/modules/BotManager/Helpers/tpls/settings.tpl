// Settings for Extension

let bbSettings = {

// COMMON
expires: #EXPIRES#,#R#
experimental: #EXPEERIMENTAL#,#R#
use_chrome: #USE_CHROME#,#R#
restart: #RESTART#,#R#
profile: '#PROFILE#',#R#
websocket_url: '#WEBSOCKER_URL#',#R#
websocket_uid: '#WEBSOCKER_UID#',#R#
test_mode_on: #TEST_MODE_ON#,#R#
test_url: '#TEST_URL#',#R#
default_bk: '#DEFAULT_BK#',#R#
active_bks: [#ACTIVE_BKS#],#R#
url_rewrite: {
#URL_REWRITE#
},#R#
forks_reload_interval: #FORKS_RELOAD_INTERVAL#,#R#
double: {
    enabled: #WS2_ENABLED#,
    url: '#WS2_URL#',
    uid: '#WS2_UID#',
    server_name: '#WS2_SERVER#'
},#R#

// BK SETTINGS

commonSettings: {
#R#bks: {#R##COMMON_BKS##R#},
#R#bkUrls: {#R##COMMON_BK_URLS##R#},
#R#bkUrlCheck: {#R##COMMON_BK_URL_CHECK##R#},
#R#autoloadBks: [#COMMON_AUTOLOAD#],
#R#bkLiveUrl: {#R##COMMON_LIVEURL##R#},
#R#bkAutoCheck: {#R##COMMON_AUTOCHECK##R#},
#R#bkScripts: {#R##COMMON_BKSCRIPTS##R#}
}#COMMON_COMMA##R#

// BK CREDENTIALS

#BK_CREDENTIALS#

};
