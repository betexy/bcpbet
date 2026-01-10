<?php

/* @var $this yii\web\View */
/* @var $id string */

use yii\helpers\Url;

$this->title = "Testing ground {$id}";

$this->registerCss("
.card-body {
    padding: 0.75rem 1.25rem !important;
}
.exlg {
    max-width: 950px !important;
}
");
$this->registerJsFile(Url::toRoute(['files/internal-js', 'name' => 'testing-ground.js']));
?>
<input type="hidden" id="tgId" value="<?=$id?>" />
<div class="container">
    <div class="card">
        <div class="row">
            <div class="input-group col-sm-6">
                <div class="input-group-prepend">
                    <div class="input-group-text">
                        <input type="checkbox" aria-label="Save commands" id="save_commands" value="">
                        <label for="save_commands" style="margin: 0 0 0 5px;">Save commands</label>
                    </div>
                </div>
                <input class="form-control" type="text" placeholder="Memo" id="saveMemo" value=""/>
            </div>
            <div class="col-sm-2">
                <a class="btn btn-light" href="#" onclick="repeatLast(); return false;">Repeat last</a>
            </div>
            <div class="col-sm-2">
                <a class="btn btn-secondary" href="#" onclick="historySelect(); return false;">Show history</a>
            </div>
            <div class="col-sm-2">
                <a class="btn btn-light" href="/">Back to application</a>
            </div>
        </div>
    </div>
</div>
<div class="container-fluid">
    <div class="card">
        <div class="card-body">
            <div class="row">
                <div class="col-sm-7">
                    Sent:
                </div>
                <div class="col-sm-5">
                    Received:
                </div>
            </div>
            <div class="form-group row">
                <div class="col-sm-7">
                    <span style="font-size: 13px; font-family: monospace;" id="sentStatus"></span>
                </div>
                <div class="col-sm-5">
                    <span style="font-size: 13px; font-family: monospace;" id="receivedStatus"></span>
                    <span><a href="bb_test.php?action=clearReceived"><small>Clear</small></a></span>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="container">
    <div class="row">
        <div class="col-md-12">
            <form>
                <div class="card additionalCard" id="additional">
                    <div class="card-body">
                        <div class="form-group row">
                            <div class="col-sm-9">
                                <h5 class="card-title">Data block #<span data-t="number">1</span></h5>
                            </div>
                            <div class="col-sm-3">
                                <button class="btn btn-info" onclick="addAdditional(); return false;">Add
                                </button>
                                <button class="btn btn-danger"
                                        onclick="removeAdditional(this); return false;">
                                    Delete
                                </button>
                                <button class="btn btn-warning" onclick="clearForm(); return false;">
                                    Clear
                                </button>
                            </div>
                        </div>
                        <div class="form-group row">
                            <div class="input-group col-sm-3">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">Sport:</span>
                                </div>
                                <select class="form-control" data-name="sport" id="sport">
                                    <option value="FOOTBALL" selected>FOOTBALL</option>
                                    <option value="TENNIS">TENNIS</option>
                                    <option value="TABLETENNIS">TABLETENNIS</option>
                                    <option value="HOCKEY">HOCKEY</option>
                                    <option value="VOLLEYBALL">VOLLEYBALL</option>
                                    <option value="BASEBALL">BASEBALL</option>
                                    <option value="BASKETBALL">BASKETBALL</option>
                                    <option value="HANDBALL">HANDBALL</option>
                                    <option value="CYBERSPORT">CYBERSPORT</option>
                                    <option value="ALL">ALL (get_events)</option>
                                </select>
                            </div>
                            <div class="input-group col-sm-4">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">Type:</span>
                                </div>
                                <select class="form-control" data-name="type" id="type">
                                    <option value="LIVE">LIVE</option>
                                    <option value="PREMATCH">PREMATCH</option>
                                </select>
                                <input type="text" class="form-control" data-name="date" id="date"
                                       placeholder="Date: YYYY/DD/DD"/>
                            </div>
                            <div class="input-group col-sm-5">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">Time value:</span>
                                </div>
                                <select class="form-control" data-name="time_value" id="time_value">
                                    <option value="FULL_TIME" data-sport="FOOTBALL">FULL_TIME</option>
                                    <option value="FULL_TIME" data-sport="CYBERSPORT">FULL_TIME</option>
                                    <option value="FULL_TIME"
                                            data-sport="TENNIS TABLETENNIS HOCKEY VOLLEYBALL BASEBALL BASKETBALL HANDBALL">
                                        FULL_MATCH
                                    </option>
                                    <option value="TIME_1" data-sport="FOOTBALL BASKETBALL HANDBALL">
                                        HALF_TIME
                                    </option>
                                    <option value="HALF_TIME" data-sport="BASKETBALL HANDBALL">HALF_TIME
                                    </option>
                                    <?php for ($i = 1; $i <= 5; $i++) { ?>
                                        <option value="SET_<?= $i ?>" data-sport="TENNIS TABLETENNIS">
                                            SET_<?= $i ?>
                                        </option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 50; $i++) { ?>
                                        <option value="GAME_<?= $i ?>" data-sport="TENNIS TABLETENNIS">
                                            GAME_<?= $i ?>
                                        </option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 3; $i++) { ?>
                                        <option value="PERIOD_<?= $i ?>" data-sport="HOCKEY">
                                            PERIOD_<?= $i ?></option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 9; $i++) { ?>
                                        <option value="INNING_<?= $i ?>" data-sport="BASEBALL">
                                            INNING_<?= $i ?></option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 5; $i++) { ?>
                                        <option value="SET_<?= $i ?>" data-sport="VOLLEYBALL">
                                            SET_<?= $i ?></option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 4; $i++) { ?>
                                        <option value="Q_<?= $i ?>" data-sport="BASKETBALL">
                                            Q_<?= $i ?></option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 4; $i++) { ?>
                                        <option value="MAP_<?= $i ?>" data-sport="CYBERSPORT">
                                            MAP_<?= $i ?></option>
                                    <?php } ?>
                                </select>
                                <select class="form-control" data-name="time_value_add"
                                        id="time_value_add">
                                    <option value="FULL_TIME" data-sport="FOOTBALL">FULL_TIME</option>
                                    <option value="FULL_MATCH"
                                            data-sport="TENNIS HOCKEY VOLLEYBALL BASEBALL BASKETBALL HANDBALL">
                                        FULL_MATCH
                                    </option>
                                    <option value="HALF_TIME" data-sport="FOOTBALL BASKETBALL HANDBALL">
                                        HALF_TIME
                                    </option>
                                    <?php for ($i = 1; $i <= 5; $i++) { ?>
                                        <option value="SET_<?= $i ?>" data-sport="TENNIS">
                                            SET_<?= $i ?></option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 50; $i++) { ?>
                                        <option value="GAME_<?= $i ?>" data-sport="TENNIS">
                                            GAME_<?= $i ?></option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 3; $i++) { ?>
                                        <option value="<?= $i ?>_PERIOD" data-sport="HOCKEY"><?= $i ?>
                                            _PERIOD
                                        </option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 9; $i++) { ?>
                                        <option value="INNING_<?= $i ?>" data-sport="BASEBALL">
                                            INNING_<?= $i ?></option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 5; $i++) { ?>
                                        <option value="<?= $i ?>_SET" data-sport="VOLLEYBALL"><?= $i ?>
                                            _SET
                                        </option>
                                    <?php } ?>
                                    <?php for ($i = 1; $i <= 4; $i++) { ?>
                                        <option value="Q<?= $i ?>" data-sport="BASKETBALL">
                                            Q<?= $i ?></option>
                                    <?php } ?>
                                </select>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-sm-12">
                                <small>Please note: arrays now possible in <strong>teams and
                                        league</strong>, it must be
                                    separated using <code>:;</code></small>
                            </div>
                        </div>
                        <div class="form-group row">
                            <div class="input-group col-sm-9">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">League</span>
                                </div>
                                <input class="form-control" type="text" id="league" data-name="league"
                                       value=""
                                       size="100"/>
                            </div>
                            <div class="input-group col-sm-3">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">ID</span>
                                </div>
                                <input class="form-control" type="text" id="event_id" data-name="event_id"
                                       value=""
                                       size="100"/>
                            </div>
                        </div>
                        <div class="form-group row">
                            <div class="input-group col-sm-6">
                                <div class="input-group-prepend">
                                            <span class="input-group-text"><a href="#"
                                                                              onclick="clearCommand(); return false;">Team 1</a></span>
                                </div>
                                <input class="form-control" type="text" id="team1" data-name="team1"
                                       value=""
                                       size="20"/>
                            </div>
                            <div class="input-group col-sm-6">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">Team 2</span>
                                </div>
                                <input class="form-control" type="text" id="team2" data-name="team2"
                                       value=""
                                       size="20"/>
                            </div>
                        </div>
                        <div class="form-group row">
                            <div class="input-group col-sm-12">
                                <div class="input-group-prepend">
                                    <span class="input-group-text">Market</span>
                                </div>
                                <select class="form-control" id="market" data-name="market"
                                        style="min-width: 120px;">
                                    <option value="TOTAL">TOTAL</option>
                                    <option value="T1_TOTAL">T1_TOTAL</option>
                                    <option value="T2_TOTAL">T2_TOTAL</option>
                                    <option value="CORNER_TOTAL">CORNER_TOTAL</option>
                                    <option value="HDP">HDP</option>
                                    <option value="EURO_HDP">EURO_HDP</option>
                                    <option value="CORNER_HDP">CORNER_HDP</option>
                                    <option value="ONE_TWO">ONE_TWO</option>
                                </select>
                                <div class="input-group-append">
                                    <span class="input-group-text">Target</span>
                                </div>
                                <select class="form-control" id="target" data-name="target">
                                    <option data-market="TOTAL T1_TOTAL T2_TOTAL CORNER_TOTAL"
                                            value="OVER">Over
                                    </option>
                                    <option data-market="TOTAL T1_TOTAL T2_TOTAL CORNER_TOTAL"
                                            value="UNDER">Under
                                    </option>
                                    <option data-market="HDP CORNER_HDP" value="HOME">Home</option>
                                    <option data-market="HDP CORNER_HDP" value="AWAY">Away</option>
                                    <option data-market="EURO_HDP" value="H1">H1</option>
                                    <option data-market="EURO_HDP" value="HX">HX</option>
                                    <option data-market="EURO_HDP" value="H2">H2</option>
                                    <option data-market="ONE_TWO" value="ONE">One</option>
                                    <option data-market="ONE_TWO" value="TWO">Two</option>
                                    <option data-market="ONE_TWO" value="DRAW">Draw</option>
                                    <option data-market="ONE_TWO" value="ONE_DRAW">1 or draw</option>
                                    <option data-market="ONE_TWO" value="TWO_DRAW">Draw or 2</option>
                                    <option data-market="ONE_TWO" value="ONE_TWO">1 or 2</option>
                                </select>
                                <div class="input-group-append">
                                    <span class="input-group-text">Pivot</span>
                                </div>
                                <input class="form-control" type="text" id="pivot" data-name="pivot"
                                       value=""
                                       size="10"/>
                                <div class="input-group-append">
                                    <span class="input-group-text">Coef</span>
                                </div>
                                <input class="form-control" type="text" id="coef" data-name="coef" value=""
                                       size="10"/>
                                <div class="input-group-append">
                                    <span class="input-group-text">Stake</span>
                                </div>
                                <input class="form-control" type="text" id="stake" data-name="stake"
                                       value=""
                                       size="10"/>
                                <div class="input-group-append">
                                    <span class="input-group-text">Score</span>
                                </div>
                                <input class="form-control" type="text" id="score" data-name="score"
                                       value=""
                                       size="10"/>
                            </div>
                        </div>
                        <div id="allCommands">
                            <div class="row">
                                <div class="col-sm-12">
                                    <small>Special parameters for certain commands (look at
                                        placeholders), separator - semicolon
                                        <a href="#" onclick="clearExternal(this); return false;">clear</a>:
                                    </small>
                                </div>
                            </div>
                            <div class="form-group row">
                                <div class="input-group col-sm-12">
                                    <div class="input-group-prepend">
                                        <label class="input-group-text" for="paysystem">PS</label>
                                    </div>
                                    <select class="form-control" id="paysystem" data-name="paysystem">
                                        <option value="">---</option>
                                        <option value="BTC">Bitcoin</option>
                                        <option value="NETELLER">Neteller</option>
                                        <option value="QIWI">Qiwi</option>
                                        <option value="SKRILL">Skrill</option>
                                        <option value="PAYEER">Payeer</option>
                                        <option value="PM">Perfect Money</option>
                                        <option value="YOU_MONEY">You Money</option>
                                    </select>
                                    <input class="form-control" type="text" id="extid1" data-name="extid1"
                                           value=""
                                           size="15" placeholder="amount"/>
                                    <input class="form-control" type="text" id="extid2" data-name="extid2"
                                           value=""
                                           size="15" placeholder="login"/>
                                    <input class="form-control" type="text" id="extid3" data-name="extid3"
                                           value=""
                                           size="15" placeholder="password"/>
                                    <input class="form-control" type="text" id="extid4" data-name="extid4"
                                           value=""
                                           size="15" placeholder="PIN"/>
                                    <input type="text" id="first_name" data-name="first_name" value=""
                                           placeholder="First name"
                                           class="form-control"/>
                                    <input type="text" id="last_name" data-name="last_name" value=""
                                           placeholder="Second name"
                                           class="form-control"/>
                                </div>
                            </div>
                            <div class="form-group row">
                                <div class="input-group col-sm-12">
                                    <input type="text" id="sms" data-name="sms" value=""
                                           placeholder="Phone"
                                           class="form-control"/>
                                    <div class="input-group-append">
                                        <div class="input-group-text">
                                            <input type="checkbox" aria-label="Use custom extensions"
                                                   id="custom_extensions"
                                                   data-name="custom_extensions">
                                            <label for="custom_extensions" style="margin: 0 0 0 5px;">Custom
                                                extensions</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="form-group row">
                                <div class="input-group col-sm-12">
                                    <input class="form-control" type="text" id="wallet_email"
                                           data-name="wallet_email"
                                           value=""
                                           placeholder="Email" size="10"/>
                                    <input class="form-control" type="text" id="email_password"
                                           data-name="email_password"
                                           value=""
                                           placeholder="Email password" size="10"/>
                                    <input class="form-control" type="text" id="recipient"
                                           data-name="recipient" value=""
                                           placeholder="Recipient" size="10"/>
                                    <input class="form-control" type="text" id="interval"
                                           data-name="interval"
                                           value=""
                                           placeholder="Interval" size="10"/>
                                    <input class="form-control" type="text" id="fall_coef"
                                           data-name="fall_coef" value="" list="cappers_list"
                                           placeholder="Fall coef" size="10"/>
                                    <datalist id="cappers_list">
                                        <option value="Trololoooo.SOC.L">
                                        <option value="BayBet.SOC.L">
                                        <option value="BskBets.B.L">
                                        <option value="Capper2016.SOC.L">
                                        <option value="crazyaka.UN.L">
                                        <option value="Djoodi.B.L">
                                        <option value="Finnisher.SOC.L">
                                        <option value="H_Chinaski.SOC.L">
                                        <option value="PrimeBets.T.L">
                                        <option value="Running.SOC.L">
                                        <option value="SafeExpress.SOC.L">
                                        <option value="Tennis_B_M_.T.L">
                                        <option value="UNDISPUTED.IH.L">
                                        <option value="X-rays_BIG.SOC.L">
                                    </datalist>
                                    <div class="input-group-append">
                                        <span class="input-group-text">Fork</span>
                                    </div>
                                    <select class="form-control" id="fork_shoulder"
                                            data-name="fork_shoulder"><?= $bkOptionsHtml ?></select>
                                    <div class="input-group-append">
                                        <div class="input-group-text">
                                            <input type="checkbox" aria-label="Send <fork> param with data"
                                                   id="fork_fork"
                                                   data-name="fork_fork">
                                            <label for="fork_fork" style="margin: 0 0 0 5px;">fork</label>
                                        </div>
                                    </div>
                                    <div class="input-group-append">
                                        <div class="input-group-text">
                                            <input type="checkbox" aria-label="" id="doNotOpen"
                                                   data-name="doNotOpen">
                                            <label for="doNotOpen"
                                                   style="margin: 0 0 0 5px;">doNotOpen</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="form-group row" id="dwRow" style="display: none;">
                                <div class="input-group col-sm-12">
                                    <input class="form-control col-sm-2" type="text" id="dw_date"
                                           data-name="dw_date"
                                           value=""
                                           placeholder="Birthdate" />
                                    <input class="form-control col-sm-4" type="text" id="dw_address"
                                           data-name="dw_address"
                                           value=""
                                           placeholder="Address" />
                                    <input class="form-control col-sm-2" type="text" id="dw_passport"
                                           data-name="dw_passport"
                                           value=""
                                           placeholder="Passport" />
                                    <input class="form-control col-sm-2" type="text" id="dw_date_passport"
                                           data-name="dw_date_passport"
                                           value=""
                                           placeholder="Issued" />
                                    <input class="form-control col-sm-2" type="text" id="dw_issued_by"
                                           data-name="dw_issued_by"
                                           value=""
                                           placeholder="Issued By" />
                                </div>
                            </div>
                        </div>
                        <div id="cuProfile" style="display: none;">
                            <div class="row">
                                <div class="col-sm-12">
                                            <textarea id="cu_data" class="form-control" rows="4"
                                                      placeholder="JSON-data for command"></textarea>
                                </div>
                                <div class="col-sm-12">
                                    <input class="form-control" id="cu_uuid"
                                           placeholder="Multilogin profile UUID"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card" id="buttons">
                    <div class="card-body">
                        <div class="row">
                            <div class="input-group col-sm-12">
                                <select class="form-control" id="bk" data-name="bk">
                                    <?= $bkOptionsHtml ?>
                                </select>
                                <input class="form-control" type="text" id="room_uid" value=""
                                       placeholder="UID" size="20"/>
                                <select class="form-control" id="command" data-name="command">
                                    <option value=""></option>
                                    <optgroup label="Bookie:">
                                        <option value="BET">Bet</option>
                                        <option value="EXPRESS">Express</option>
                                        <option value="BET_RESULT">Bet result</option>
                                        <option value="DEPOSIT">Deposit</option>
                                        <option value="WITHDRAW">Withdraw</option>
                                        <option value="START_BK">Start Bk</option>
                                        <option value="STOP_BK">Stop Bk</option>
                                    </optgroup>
                                    <optgroup label="Wallet:">
                                        <option value="TRANSFER_FUNDS">Transfer</option>
                                        <option value="WALLET_BALANCE">Balance</option>
                                    </optgroup>
                                    <optgroup label="Tech:">
                                        <option value="START">Start Profile</option>
                                        <option value="START_MANUAL">Manual Start Profile</option>
                                        <option value="STATUS">Status</option>
                                        <option value="STOP">Stop Profile</option>
                                        <option value="RESTART">Restart</option>
                                        <option value="CREATE_PROFILE">Create Profile</option>
                                        <option value="UPDATE_PROFILE">Update Profile</option>
                                        <option value="DELETE_PROFILE">Delete Profile</option>
                                        <option value="INSTALL">Install</option>
                                        <option value="REBOOT">Reboot</option>
                                        <option value="CHECK_LIMITED">Check limited</option>
                                    </optgroup>
                                    <optgroup label="Legacy/debug:">
                                        <option value="WAIT5MINUTES">Wait 5 minutes</option>
                                        <option value="MAXIMUM">MAXIMUM</option>
                                        <option value="EXPRESS_BET">EXPRESS_BET</option>
                                        <option value="MULTI_BET">MULTI_BET</option>
                                        <option value="READY_TO_BET">READY_TO_BET</option>
                                        <option value="ARB_BET">ARB_BET</option>
                                        <option value="FORK">FORK</option>
                                        <option value="MONITOR">MONITOR</option>
                                        <option value="CHECK_PAYMENTS">Check payments</option>
                                        <option value="PING">PING</option>
                                        <option value="BOT_RESTART">BOT_RESTART</option>
                                        <option value="GET_EVENTS">GET_EVENTS</option>
                                        <option value="takeScreenshot">Take screenshot</option>
                                        <option value="openBk">Open BK</option>
                                        <option value="getBalance">Ask Balance</option>
                                        <option value="openEvent">Open Event</option>
                                        <option value="SMS">SMS</option>
                                        <option value="REGISTER">Register</option>
                                        <option value="CONFIRMATION">Confirmation</option>
                                    </optgroup>
                                </select>
                                <div class="input-group-btn">
                                    <button class="btn btn-success" onclick="execute(); return false;">
                                        Execute command
                                    </button>
                                </div>
                                <div class="input-group-append">
                                    <div class="input-group-text">
                                        <input type="checkbox" aria-label="Check lmited" id="check_limited"
                                               data-name="check_limited">
                                        <label for="check_limited" style="margin: 0 0 0 5px;">CHL</label>
                                    </div>
                                </div>
                                <div class="input-group-append">
                                    <div class="input-group-text">
                                        <input type="checkbox" aria-label="Use new API" id="is_new_api"
                                               data-name="is_new_api">
                                        <label for="is_new_api" style="margin: 0 0 0 5px;">new</label>
                                    </div>
                                </div>
                                <div class="input-group-append">
                                    <span class="input-group-text">Euro</span>
                                </div>
                                <input class="form-control" type="text" id="euro_rub" value=""
                                       placeholder="RUB" size="10"/>
                                <input class="form-control" type="text" id="euro_btc" value=""
                                       placeholder="BTC" size="10"/>
                            </div>
                        </div>
                        <div class="row" style="margin-top: 20px;">
                            <div class="input-group col-sm-12">
                                <div class="input-group-prepend">
                                    <label class="input-group-text">API:</label>
                                </div>
                                <input type="text" value="" placeholder="API url" id="api_url"
                                       list="api_url_list"
                                       class="form-control"
                                       style="width: 30%;">
                                <datalist id="api_url_list">
                                    <option value="http://double.bcp.bet">
                                </datalist>
                                <input type="text" value="" placeholder="Source Id" id="api_source"
                                       class="form-control"
                                       style="width: 10%;">
                                <input type="text" value="" placeholder="Ex-n (default 2m)"
                                       id="api_expiration"
                                       class="form-control" style="width: 10%;">
                                <div class="input-group-append">
                                    <div class="input-group-text">
                                        <input type="checkbox" aria-label="Do not check with oddsfan"
                                               id="do_not_check"
                                               data-name="do_not_check">
                                        <label for="do_not_check" style="margin: 0 0 0 5px;">!check</label>
                                    </div>
                                </div>
                                <div class="input-group-btn">
                                    <button class="btn btn-info" onclick="execute('API'); return false;">
                                        Call API
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    </div>
</div>