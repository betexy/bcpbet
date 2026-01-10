function  MainCycle () {
    this.forkCycle = false;
    this.delayedBetsSupport = [
        'bet365',
        'marathon',
        'fon',
        'olimpold',
        'cloudbet'
    ];
    this.common = new Common(this);

    this._arbBet = function (command, bk) {
        if (this.delayedBetsSupport.indexOf(bk) === -1) {
            this.common.sendAnswer(bk, {
                action: command.action,
                data: {
                    status: 'NOT SUPPORTED',
                },
                answer: command.action + ' not supported for ' + command.bk
            });
        } else if (command.action === 'ARB_BET' && typeof (command.data[0] !== 'undefined') && parseInt(command.data[0].interval) === -1) {
            this.common.currentCommandClear();
        } else if (command.action === 'ARB_BET' && this.common.command.previousCommand.action !== 'READY_TO_BET') {
            this.common.sendAnswer('BET_RESULT', {
                action: 'BET_RESULT',
                data: {
                    "external_id": '',
                    "status": 'FAILED',
                    "market": command.data[0].market,
                    "target": command.data[0].target,
                    "pivot": command.data[0].pivot,
                    "coef": command.data[0].coef,
                    "stake": command.data[0].stake,
                    "maximum": null
                },
                answer: 'ARB_BET must follow for READY_TO_BET, but it is ' + this.common.command.previousCommand.action
            });
        } else {
            this.common.openBkAndSendActionWithData(command, bk);
        }
    }

}
