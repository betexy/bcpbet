var API_CALL = false;
const tgId = $('#tgId').val();
const alters = {
    'extid1': {
        'BET_RESULT': 'data[0]',
        'DEPOSIT': 'amount',
        'WITHDRAW': 'amount',
        'TRANSFER_FUNDS': 'amount',
        'WALLET_BALANCE': 'amount',
        'START': 'mg_profile',
        'START_MANUAL': 'mg_profile',
        'RESTART': 'mg_profile',
        'STOP': 'mg_profile',
        'INSTALL': 'mg_profile',
    },
    'extid2': {
        'BET_RESULT': 'data[1]',
        'DEPOSIT': 'login',
        'WITHDRAW': 'login',
        'TRANSFER_FUNDS': 'login',
        'WALLET_BALANCE': 'login',
        'START': 'bk_login',
        'START_MANUAL': 'bk_login',
        'RESTART': 'bk_login',
        'STOP': 'bk_login',
        'INSTALL': 'bk_login',
    },
    'extid3': {
        'BET_RESULT': 'data[2]',
        'DEPOSIT': 'password',
        'WITHDRAW': 'password',
        'TRANSFER_FUNDS': 'password',
        'WALLET_BALANCE': 'password',
        'START': 'bk_password',
        'START_MANUAL': 'bk_password',
        'RESTART': 'bk_password',
        'STOP': 'bk_password',
        'INSTALL': 'bk_password',
    },
    'extid4': {
        'BET_RESULT': 'data[3]',
        'DEPOSIT': 'pin',
        'WITHDRAW': 'pin',
        'TRANSFER_FUNDS': 'pin',
        'WALLET_BALANCE': 'pin',
        'START': 'phone',
        'START_MANUAL': 'phone',
        'RESTART': 'phone',
        'STOP': 'phone',
        'INSTALL': 'phone',
    },
    'first_name': {
        'BET_RESULT': 'data[4]',
        'DEPOSIT': 'first_name',
        'WITHDRAW': 'first_name',
        'TRANSFER_FUNDS': 'first_name',
        'WALLET_BALANCE': 'first_name',
        'START': 'email',
        'START_MANUAL': 'email',
        'RESTART': 'email',
        'STOP': 'email',
        'INSTALL': 'email',
    },
    'last_name': {
        'BET_RESULT': 'data[5]',
        'DEPOSIT': 'second_name',
        'WITHDRAW': 'second_name',
        'TRANSFER_FUNDS': 'second_name',
        'WALLET_BALANCE': 'second_name',
        'START': 'email_password',
        'START_MANUAL': 'email_password',
        'RESTART': 'email_password',
        'STOP': 'email_password',
        'INSTALL': 'email_password',
    },
    'sms': {
        'BET_RESULT': 'data[6]',
        'DEPOSIT': 'phone',
        'WITHDRAW': 'phone',
        'TRANSFER_FUNDS': 'phone',
        'WALLET_BALANCE': 'phone',
        'START': 'urls',
        'START_MANUAL': 'urls',
        'RESTART': 'urls',
        'STOP': 'urls',
        'INSTALL': 'urls',
    },
    'wallet_email': {
        'BET_RESULT': 'data[7]',
        'DEPOSIT': 'email',
        'WITHDRAW': 'email',
        'TRANSFER_FUNDS': 'email',
        'WALLET_BALANCE': 'email',
        'START': 'second_name',
        'START_MANUAL': 'second_name',
        'RESTART': '',
        'STOP': '',
        'INSTALL': '',
    },
    'email_password': {
        'BET_RESULT': 'data[8]',
        'DEPOSIT': 'email_password',
        'WITHDRAW': 'email_password',
        'TRANSFER_FUNDS': 'email_password',
        'WALLET_BALANCE': 'email_password',
        'START': '',
        'START_MANUAL': '',
        'RESTART': '',
        'STOP': '',
        'INSTALL': '',
    },
    'recipient': {
        'BET_RESULT': 'data[9]',
        'DEPOSIT': 'recipient',
        'WITHDRAW': 'recipient',
        'TRANSFER_FUNDS': 'recipient',
        'WALLET_BALANCE': 'recipient',
        'START': '',
        'START_MANUAL': '',
        'RESTART': '',
        'STOP': '',
        'INSTALL': '',
    },
    'interval': {
        'BET': 'concrete_id',
        'BET_RESULT': 'data[10]',
        'DEPOSIT': 'hash',
        'WITHDRAW': 'hash',
        'TRANSFER_FUNDS': 'hash',
        'WALLET_BALANCE': 'hash',
        'START': '',
        'START_MANUAL': '',
        'RESTART': '',
        'STOP': '',
        'INSTALL': '',
    },
    'fall_coef': {
        'BET': 'capper_id',
        'BET_RESULT': 'data[11]',
        'DEPOSIT': 'mg_profile',
        'WITHDRAW': 'mg_profile',
        'TRANSFER_FUNDS': 'mg_profile',
        'WALLET_BALANCE': 'mg_profile',
        'START': '',
        'START_MANUAL': '',
        'RESTART': '',
        'STOP': '',
        'INSTALL': '',
    },
};
$bkUrls = {
    '1XBET': 'https://1xbet.com/ru/live/',
    '1XSTAVKA': 'https://1xstavka.ru/live/',
    '21BET': 'https://www.21bet.com/pages.sports.aqp?tab=Live',
    '32RED': 'https://www.32red.com/sport',
    '888SPORT': 'https://www.888sport.com/live-betting/',
    'ASTEKBET': 'https://astekbet.com/live/',
    'BET365': 'https://www.bet365.com/#/IP/',
    'BETANDYOU': 'https://betandyou.com/ru/live/',
    'BETBOOM': 'https://betboom.ru/sport',
    'BETCITY': 'https://betcityru.com/en/live',
    'BETSSON': 'https://www.betsson.com/en/sportsbook/live/football',
    'BETWAY': 'https://sports.betway.com/en/sports/in-play',
    'BETWINNER': 'https://betwinner.com/live/',
    'BFSPORTSBOOK': 'https://www.betfair.com/sport/inplay',
    'BOYLESPORTS': '',
    'BWIN': 'https://livebetting.bwin.com/en/live',
    'BWIN.CUPIS': 'https://livebetting.bwin.ru/en/live',
    'CAMPOBET': 'http://campobet.com/en/sport/live',
    'CASINOWINNER': 'https://www.casinowinner.com/en/sport',
    'CLOUDBET': 'https://www.cloudbet.com/en/',
    'DOUBLEBET': 'https://db-bet.com/live/',
    'DAFABET': 'https://www.dafabet.com/en/sports-df/sports',
    'GAMEBOOKERS': 'https://sports.gamebookers.com/en/sports/live/betting',
    'FANSPORT': 'https://fan-sport4.com/live/',
    'FAVBET': 'https://www.favbet.com/ru/live/',
    'FONBET': 'https://www.fonbet.com/#!/live',
    'FONBET.CUPIS': 'https://www.fonbet.ru/live',
    'LADBROKES': 'https://sports.ladbrokes.com/in-play',
    'LEON': 'https://ru.leonbets.net/bet-on-live-matches',
    'LEON.CUPIS': 'https://www.leon.ru/stavki-live',
    'LIGASTAVOK': 'https://www.ligastavok.ru/bets/live',
    'LINEBET': 'https://linebet.com/live/',
    'MARATHON': 'https://www.marathonbet.com/en/live/',
    'MARATHON.CUPIS': 'https://www.marathonbet.ru/su/live/',
    'MELBET': 'https://melbet.ru/live/',
    'BET8GR': 'https://mostbet.com/live',
    'NORDICBET': 'https://www.nordicbet.com/en/sportsbook/live/football',
    'OLIMP': 'https://olimp.com/betting',
    'OLIMP.CUPIS': 'https://www.olimp.bet/live',
    'PADDYPOWER': 'https://www.paddypower.com/inplay',
    'PARIMATCH': 'https://parimatch.com/live.html',
    'PARIMATCH.CUPIS': 'https://new.parimatch.ru/ru/live/soccer',
    'PARTYPOKER': 'https://sports.partypoker.com/en/sports/live/betting',
    'PINUP': 'https://pinup.bet/live',
    'PINUP.CUPIS': 'https://pin-up.ru/live',
    'RIOBET': 'https://riobet.com/en/sport/live',
    'SPORTINGBET': 'https://sports.sportingbet.com/en/sports/live/betting',
    'TENNISI': 'http://tennisi.com/m38fhcn/cgi/!FREE.Welcome?lang=rus',
    'TITANBET': 'https://sports.titanbet.com/en/football',
    'VBET': 'https://www.vbet.com/#/sport/?type=1',
    'UNIBET': 'https://www.unibet.com/betting',
    'WILLIAMHILL': 'http://sports.williamhill.com/bet/en-gb/betlive/all',
    'WINLINEBET': 'https://winlinebet.com',
    'WINLINE.CUPIS': 'https://winline.ru/',
    'ZULABET': 'https://zulabet1.com/en/sport/live',
    'BTC': 'no-url',
    'NETELLER': 'no-url',
    'QIWI': 'no-url',
    'SKRILL': 'no-url',
    'PAYEER': 'no-url',
    'PM': 'no-url',
    'YOU_MONEY': 'no-url',
    'WHATISMYIP': 'https://whoer.net',
    'MYIP': 'https://2ip.ru',
};
$(function () {
    $('#target option').hide();
    $('form input[id!="type"]').val('');
    $('form select[id!="sport"][id!="time_value"]').val('');
    /*
    $('#command').change(function () {
        if (['openEvent', 'BET'].indexOf($(this).val()) > -1) {
            $('#additional').show();
        } else {
            $('#additional').hide();
        }
    });
    */
    $('#market').on('change', function () {
        $('#target').val('');
        $('#target option').hide();
        $('#target option[data-market~="' + $(this).val() + '"]').show();
    });

    $('body').on('click', '.hSelBtn', function (e) {
        let rowId = $(this).attr('ldl-d-id');
        $('#historyModal').modal('hide');
        repeatLast(rowId);
    });

    $('body').on('click', '.hDelBtn', function (e) {
        let rowId = $(this).attr('ldl-d-id');
        if (!confirm('Are you sure? Really?')) {
            return;
        }
        $('#historyModal').modal('hide');
        deleteCommand(rowId);
    });

    setInterval(function () {
        if (API_CALL) {
            return;
        }
        $.get(`/BotManager/default/bb-bot?id=${tgId}`, function (data) {
            if ($('#receivedStatus').text() !== data) {
                $('#receivedStatus').text(data);
            }
        });
    }, 1500);

    let changeSport = function (el) {
        let $tv = $(el).closest('div.card-body').find('select[data-name="time_value"]');
        $tv.find('option').hide();
        $tv.find('option[data-sport~="' + $(el).val() + '"]').show();
        if ($tv.find('option[style=""]').length === 0) {
            $tv.val('');
            $tv.attr('style', 'background-color: red;')
        } else {
            $tv.find('option[style=""]').first().prop('selected', true);
            $tv.attr('style', 'background-color: transparent;');
        }
        let $options = $tv.find('option').clone();
        $(el).closest('div.card-body').find('select[data-name="time_value_add"]').find('option').remove();
        $(el).closest('div.card-body').find('select[data-name="time_value_add"]').append('<option value="" selected></option>').append($options);
        $(el).closest('div.card-body').find('select[data-name="type"] option[value="LIVE"]').attr('selected', true);
        $(el).closest('div.card-body').find('input[data-name="date"]').val((new Date()).toISOString().substr(0, 10).replace(/-/g, '/'));
    };

    $('body').on('change', 'select[data-name="sport"]', function () {
        changeSport(this);
    });

    changeSport($('#sport')[0]);

    const hideShowUid = show => $('#room_uid')[show ? 'show' : 'hide']();
    const $is_new_api = $('#is_new_api');
    $is_new_api.prop('checked', Cookies.get(`use_new_api_${tgId}`) && Cookies.get(`use_new_api_${tgId}`) > 0);
    hideShowUid($is_new_api.prop('checked'));
    $is_new_api.on('change', function () {
        Cookies.set(`use_new_api_${tgId}`, $(this).prop('checked') ? 1 : 0);
        hideShowUid($(this).prop('checked'));
    });
    const $save_commands = $('#save_commands');
    $save_commands.prop('checked', Cookies.get(`save_history_${tgId}`)
        && Cookies.get(`save_history_${tgId}`) > 0);
    $save_commands.on('change', function () {
        Cookies.set(`save_history_${tgId}`, $(this).prop('checked') ? 1 : 0);
    });

    $('#command').on('change', function () {
        const v = $(this).val();
        if (['BET', 'BET_RESULT', 'DEPOSIT', 'WITHDRAW', 'TRANSFER_FUNDS', 'WALLET_BALANCE', 'START',
            'START_MANUAL', 'RESTART', 'STOP', 'INSTALL']
            .indexOf(v) > -1) {
            Object.keys(alters).forEach(id => {
                $(`#${id}`).attr('placeholder', alters[id][v]);
            });
            if (['START', 'START_MANUAL', 'RESTART', 'STOP', 'INSTALL'].indexOf(v) > -1) {
                const bk = $('#bk').val();
                let $sms = $('input[data-name="sms"]');
                if ($sms.text().trim() === '') {
                    $sms.val($bkUrls[bk]);
                }
                $('#room_uid').val(bk.toLowerCase());
            }
        }
        $('#dwRow')[['DEPOSIT', 'WITHDRAW'].indexOf(v) > -1 ? 'show' : 'hide']();
        if (['CREATE_PROFILE', 'UPDATE_PROFILE', 'DELETE_PROFILE'].indexOf(v) > -1) {
            $('#allCommands').hide();
            $('#cuProfile').show();
        } else {
            $('#cuProfile').hide();
            $('#allCommands').show();
        }
    });

});

function executeRegister() {
    API_CALL = false;
    let data = {};
    $('#registerForm input').each(function () {
        let $this = $(this);
        if ($this.attr('data-register') !== '') {
            data[$this.attr('data-register')] = $this.val();
        }
    });
    console.log(data);
    let subIdx = parseInt(data.postal_code.substring(0, 3));
    data['region'] = typeof indices[subIdx] === 'string' ? indices[subIdx] : '---';
    $.post('bb_test.php?action=save_command', {
        json: JSON.stringify({action: $('#command').val(), bk: $('#bk').val(), data: data})
    }, function (d) {
        $('#sentStatus').text(d);
    });
}

function execute(api) {
    const command = $('#command').val();
    if ($('#save_commands').prop('checked')
        && ['CREATE_PROFILE', 'UPDATE_PROFILE', 'DELETE_PROFILE'].indexOf(command) === -1) {
        const saveData = {cards: [], buttons: {}};
        $('#buttons').find('input, select').each(function () {
            const $this = $(this);
            saveData.buttons[$this.attr('id')] = $this.get(0).type === 'checkbox'
                ? $this.prop('checked') ? "1" : "0" : $this.val();
        });
        $('.additionalCard').each(function () {
            const current = {};
            $(this).find('[data-name]').each(function () {
                const $this = $(this);
                current[$this.attr('data-name')] = $this.get(0).type === 'checkbox' ? $this.prop('checked') ? "1" : "0" : $this.val();
            });
            saveData.cards.push(current);
        });
        $.post('bb_bot.php?action=save_command', {
            command_id: `${Date.now()}:;${$('#bk').val()}:;${$('#command').val()}`,
            command_data: JSON.stringify(saveData),
            command_memo: $('#saveMemo').val(),
        }, function (d) {
            $('#saveMemo').val('');
            console.log('Command saved!');
            if (d) {
                console.log(d);
            }
        });
    }
    API_CALL = !!(api && api === 'API');
    let data = [];
    if (command === 'REGISTER') {
        $('#modalDialogue').modal('show');
        return;
    }
    const isNew = $('#is_new_api').prop('checked');
    if (command === 'SMS') {
        data = {code: $('#sms').val()};
    } else if (command === 'BET_RESULT') {
        Object.keys(alters).forEach(n => {
            const v = $(`input[data-name="${n}"]`).first().val();
            if (v !== '') {
                data.push(v);
            }
        });
    } else if (['START', 'START_MANUAL', 'RESTART', 'STOP', 'INSTALL'].indexOf(command) > -1) {
        data = {};
        const errors = [];
        Object.keys(alters).forEach(id => {
            const v = $(`#${id}`).val();
            const t = alters[id][command].replace('mg_profile', 'multilogin_profile').replace(/bk_/g, '');
            if (t.length === 0) {
                return;
            }
            if (v.length < 3 && alters[id][command] !== 'second_name') {
                errors.push(`You must provide ${t}`);
            } else {
                data[t] = t === 'urls' ? v.split(';') : v;
            }
        });
        if ($('#custom_extensions').prop('checked')) {
            data['custom_extensions'] = true;
        }
        if (errors.length > 0) {
            alert(errors.join("\n\r"));
            return;
        }
    } else if (['CREATE_PROFILE', 'UPDATE_PROFILE', 'DELETE_PROFILE'].indexOf(command) > -1) {
        const clear = $('#cu_data').val().replace(/(\r\n|\n|\r)/gm, "").replace(/\s+/g, ' ').trim();
        try {
            data = {
                request_ml: command === "DELETE_PROFILE" ? {} : JSON.parse(clear),
                uuid: $('#cu_uuid').val().trim(),
            };
        } catch (e) {
            alert('Error creating request!');
            data = {};
        }
    } else if (isNew && ['DEPOSIT', 'WITHDRAW', 'TRANSFER_FUNDS', 'WALLET_BALANCE'].indexOf(command) > -1) {
        if ($('#paysystem').val() === '') {
            alert("You should select paysystem!");
            return;
        }
        data = {
            'pay_system': $('#paysystem').val(),
            'login': $('#extid2').val(),
            'password': $('#extid3').val(),
            'pin': $('#extid4').val(),
            'first_name': $('#first_name').val(),
            'second_name': $('#last_name').val(),
            'phone': $('#sms').val(),
            'email': $('#wallet_email').val(),
            'hash': $('#interval').val(),
        };
        if (['DEPOSIT', 'WITHDRAW'].indexOf(command) > -1) {
            data['amount'] = $('#extid1').val();
            data['email_password'] = $('#email_password').val();
            data['date'] = $('#dw_date').val();
            data['adress'] = $('#dw_address').val();
            data['passport'] = $('#dw_passport').val();
            data['date_passport'] = $('#dw_date_passport').val();
            data['issued_by'] = $('#dw_issued_by').val();
        } else if (command === 'TRANSFER_FUNDS') {
            data['amount'] = $('#extid1').val();
            data['recipient'] = $('#recipient').val();
            data['hash'] = $('#interval').val();
            data['multilogin_profile'] = $('#fall_coef').val();
        } else if (command === 'WALLET_BALANCE') {
            data['multilogin_profile'] = $('#fall_coef').val();
        }
    } else if (["MAXIMUM", "BET", "EXPRESS", "EXPRESS_BET"].indexOf(command) > -1) {
        $.each($('.additionalCard'), function () {
            const $this = $(this);
            const cur = {
                "time_value": $this.find('select[data-name="time_value"]').val()
                    + ($this.find('select[data-name="time_value_add"]').val() !== ''
                        ? '_' + $this.find('select[data-name="time_value_add"]').val() : ''),
                'type': $this.find('select[data-name="type"]').val() !== '' && $this.find('select[data-name="type"]').val() !== null
                    ? $this.find('select[data-name="type"]').val() : 'LIVE',
            };
            const vals = {
                'sport': 'sport',
                'league': 'league',
                'bk_event_native_id': 'event_id',
                'team1': 'team1',
                'team2': 'team2',
                'home': 'team1',
                'away': 'team2',
                'market': 'market',
                'date': 'date',
                'target': 'target',
                'coef': 'coef',
                'stake': 'stake',
                'score': 'score',
                'interval': 'interval',
                'fall_coef': 'fall_coef',
                'bk': 'fork_shoulder',
            };
            for (let key in vals) {
                if (vals.hasOwnProperty(key)) {
                    const val = $this.find(`[data-name="${vals[key]}"]`).val();
                    if (val !== '') {
                        cur[key] = val;
                    }
                }
            }
            if ($this.find('input[data-name="fork_fork"]').is(':checked')) {
                cur['fork'] = true;
            }
            if ($this.find('input[data-name="doNotOpen"]').is(':checked')) {
                cur['doNotOpen'] = true;
            }
            if ($('#euro_rub').val() !== '') {
                cur["euro_rub"] = $('#euro_rub').val();
            }
            if ($('#euro_btc').val() !== '') {
                cur["euro_btc"] = $('#euro_btc').val();
            }
            if ($this.find('select[data-name="market"]').val() !== 'ONE_TWO') {
                cur.pivot = $this.find('input[data-name="pivot"]').val();
            }
            if ($('#interval').val() !== '') {
                cur["concrete_id"] = $('#interval').val();
            }
            if ($('#fall_coef').val() !== '') {
                cur["capper_id"] = $('#fall_coef').val();
            }
            console.log(cur);
            data.push(cur);
        });
        if (command === 'BET' && isNew) {
            data = data[0];
        } else if (command === 'EXPRESS' && isNew) {
            let coef = 1;
            data.forEach(d => coef = coef * d.coef);
            data = {
                coef: coef.toFixed(2),
                stake: data[0].stake,
                bets: data,
            };
        }
    }

    if (api && api === 'API') {
        const do_not_check = $('#do_not_check').is(':checked');
        if ($('#api_url').val() === '') {
            alert('No API url!');
            return;
        }
        if (do_not_check && $('#bk').val() === '') {
            alert('You must specify BK when using do_not_check');
        }
        const api_expiration = parseInt($('#api_expiration').val());
        const dapi = JSON.parse(JSON.stringify(data));
        if (Array.isArray(dapi)) {
            dapi.forEach((j, k) => {
                dapi[k].coefficient = j.coef;
                delete dapi[k].coef;
                delete dapi[k].stake;
                delete dapi[k].bk;
                delete dapi[k].doNotOpen;
                delete dapi[k].euro_btc;
                delete dapi[k].euro_rub;
                delete dapi[k].fall_coef;
                delete dapi[k].fork;
                delete dapi[k].interval;
            });
        }
        const sampleData = {
            "source": $('#api_source').val(),
            "do_not_check": do_not_check,
            "bk": $('#bk').val(),
            "stake": $('#stake').val(),
            "expiration": isNaN(api_expiration) ? Math.floor(Date.now() / 1000) + 120 : api_expiration,
            "data": dapi
        };
        $('#sentStatus').html(JSON.stringify(sampleData));
        $.ajax({
            type: "POST",
            url: $('#api_url').val(),
            dataType: 'json',
            contentType: "application/json; charset=utf-8",
            //username: self.s[loginName],
            //password: self.s[passwordName],
            data: JSON.stringify(sampleData),
            success: function (d) {
                $('#receivedStatus').text(JSON.stringify(d));
                console.log(d);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                $('#receivedStatus').text(textStatus);
                console.error('API send:');
                console.log(jqXHR, textStatus, errorThrown);
            }
        });
    } else {
        const prepared = {
            action: command,
            data: data,
        };
        if (isNew) {
            const room_uid = $('#room_uid').val();
            if (room_uid === ''
                && ['CREATE_PROFILE', 'UPDATE_PROFILE', 'DELETE_PROFILE'].indexOf(command) === -1) {
                alert("You must specify UID for new API!");
                return;
            }
            prepared['room'] = {
                bk: $('#bk').val(),
                uid: room_uid,
                check_limited: $('#check_limited').prop('checked') ? 1 : 0,
            };
        } else {
            prepared['bk'] = $('#bk').val();
        }
        $.post('bb_test.php?action=save_command', {
            json: JSON.stringify(prepared)
        }, function (d) {
            $('#sentStatus').text(d);
        });
    }
}

function addAdditional() {
    var counter = $('.additionalCard').length;
    do {
        counter++;
    } while ($('#additional' + counter) === 0);
    var additional = $('#additional').html();
    var newHtml = '<div class="card additionalCard" id="additional' + counter + '">' + additional.replace(/id="(.*?)"/ig, 'id="$1' + counter + '"') + '</div>';
    $(newHtml).insertBefore('#buttons');
    $('#additional' + counter + ' span[data-t="number"]').text(counter);
    $('#target' + counter + ' option').hide();
    $('#market' + counter).val('');
    $('#target' + counter).val('');
    $('#market' + counter).change(function () {
        $('#target' + counter).val('');
        $('#target' + counter + ' option').hide();
        $('#target' + counter + ' option[data-market~="' + $(this).val() + '"]').show();
    });
}

function removeAdditional(el) {
    if ($(el).parent().parent().parent().parent().attr('id') !== 'additional') {
        $(el).parent().parent().parent().parent().remove();
    } else {
        alert("We can't remove first command!");
    }
}

function clearForm() {
    $('#cu_data').val('');
    $('#cu_uuid').val('');
    $('#check_limited').prop('checked', false);
    window.location.reload();
}

function clearCommand() {
    $('input[data-name="team1"]').each(function () {
        let splitted = $(this).val().split('-v-');
        $(this).val(splitted[0].replace(/-/g, ' '));
    });
    $('input[data-name="team2"]').each(function () {
        let splitted = $(this).val().split('-v-');
        $(this).val(splitted[splitted.length === 2 ? 1 : 0].replace(/-/g, ' '));
    });
}

function editMemo(commandId, memo) {
    const newMemo = prompt('Change memo', memo);
    if (memo !== newMemo) {
        $.post(`bb_bot.php?action=change_memo&command_id=${commandId}&new_memo=${newMemo}`, {}, function () {
            document.location.reload();
        });
    }
}

function filterBookie() {
    const bookie = $('#filter_bookie').val();
    $('#historyRows').bootstrapTable('filterBy', {bookie}, {
        'filterAlgorithm': function (row) {
            //return false;
            //console.log(row.name, `<sup>${bookie}</sup>`, row.name.indexOf(`<sup>${bookie}</sup>`) > -1);
            //console.log(bookie === '' ? true : row.name.indexOf(`<sup>${bookie}</sup>`) > -1);
            return bookie === '' ? true : row.name.indexOf(`<sup>${bookie}</sup>`) > -1;
        },
    });
}

function historySelect() {
    $.post('bb_bot.php?action=get_commands', {}, function (d) {
        let data = {};
        try {
            data = JSON.parse(d);
        } catch (e) {

        }
        const showData = [];
        const bookies = new Set();
        for (const rowId of Object.keys(data)) {
            const parts = rowId.split(':;');
            const d = new Date(parseInt(parts[0]));
            const memo = parts[3] || '-=-=-=-';
            bookies.add(parts[1]);
            showData.push({
                'time': `<small>${d.toLocaleString()}</small>`,
                'name': `<small style="font-weight: bold;">${parts[2]}</small> <sup>${parts[1]}</sup> <small>${data[rowId].cards[0].extid2}</small>`,
                'memo': `<span ondblclick="editMemo('${rowId}','${memo}'); return false;">${memo}</span>`,
                'button': `<input type="checkbox" data-check="${rowId}" value="1" />&nbsp;&nbsp;&nbsp;`
                    + `<a class="btn btn-danger hDelBtn" style="color: white;" ldl-d-id="${rowId}"><small>Del</small></a>`
                    + '&nbsp;&nbsp;&nbsp;'
                    + `<a class="btn btn-success hSelBtn" style="color: white;"  ldl-d-id="${rowId}"><small>Sel</small></a>`
            });
        }
        $('#filter_bookie option').each(function () {
            $(this).remove();
        });
        $('#filter_bookie').append('<option value="">Select bookie</option>');
        Array.from(bookies).sort().forEach(b => {
            $('#filter_bookie').append(`<option value="${b}">${b}</option>`);
        });
        $('#historyModal').modal('show');
        let $table = $('#historyRows');
        $table.bootstrapTable({data: showData, sortable: true});
    });
}

function deleteCommand(commandId) {
    $.post('bb_bot.php?action=delete_command&command_id=' + commandId, {}, function () {
        document.location.reload();
    });
}

function deleteSelected() {
    if (!confirm('D u really want to del all?')) {
        return;
    }
    const needRemove = [];
    $('input[type=checkbox][data-check]').each(function () {
        if ($(this).prop('checked')) {
            needRemove.push($(this).attr('data-check'));
        }
    });
    console.log('Need remove: ', needRemove);
    $.post('bb_bot.php?action=delete_command&commands_ids=' + btoa(unescape(encodeURIComponent(needRemove.join('==!==')))), {}, function (d) {
        document.location.reload();
    });
}

function clearExternal(el) {
    const $card = $(el).closest('div.card-body');
    for (const id of ['#paysystem', '#extid1', '#extid2', '#extid3', '#extid4', '#first_name', '#last_name', '#sms',
        '#wallet_email', '#email_password', '#recipient', '#interval', '#fall_coef',]) {
        $card.find(id).val('');
    }
    return false;
}

function repeatLast(commandId) {
    $.post('bb_bot.php?action=get_commands', {}, function (d) {
        let data = {};
        try {
            data = JSON.parse(d);
        } catch (e) {

        }
        const keys = Object.keys(data);
        if (keys.length === 0) {
            return;
        }

        const command = !commandId ? data[keys[keys.length - 1]] : data[commandId];

        for (const b of Object.keys(command.buttons)) {
            const $el = $('#buttons').find(`[id='${b}']`);
            const t = $el.get(0).type;
            if (t === 'checkbox') {
                $el.prop('checked', command.buttons[b] === '1');
            } else {
                $el.val(command.buttons[b]);
            }
        }

        const $dels = $('form button:contains("Delete"):visible');
        if ($dels.length > 1) {
            for (let i = $dels.length - 1; i > 0; i--) {
                $dels.eq(i).click();
            }
        }

        if (command.cards.length !== $('.additionalCard').length) {
            const weNeedAdd = command.cards.length - $('.additionalCard').length;
            for (let i = 0; i < weNeedAdd; i++) {
                addAdditional();
            }
        }

        let i = 0;
        for (const card of command.cards) {
            for (const di of Object.keys(card)) {
                const $el = $('.additionalCard').eq(i).find(`[data-name='${di}']`);
                const t = $el.get(0).type;
                if (t === 'checkbox') {
                    $el.prop('checked', card[di] === '1');
                } else {
                    $el.val(card[di]);
                }
            }
            i++;
        }
        if (commandId) {
            const parts = commandId.split(':;');
            const memo = parts[3] || false;
            if (memo) {
                $('#saveMemo').val(memo);
            }
        }
        $('#command').change();
        console.log('DONE!');
    });
    return false;
}