const debugQuery = () => {
    const bkRules = {
        leon: {
            condition: 'AND',
            rules: [
                {
                    id: 'href',
                    operator: 'contains',
                    value: '.leonbets.net/'
                },
                {
                    condition: 'OR',
                    rules: [
                        {
                            id: 'title',
                            operator: 'contains',
                            value: 'Букмекерская контора ЛЕОН'
                        },
                        {
                            condition: 'AND',
                            rules: [
                                {
                                    id: 'title',
                                    operator: 'contains',
                                    value: 'Актуальное зеркало'
                                },
                                {
                                    id: 'title',
                                    operator: 'contains',
                                    value: 'БК Леон'
                                },
                            ]
                        }
                    ]
                }]
        },
        unibet: {
            "condition": "OR",
            "rules": [
                {
                    "id": "href",
                    "operator": "contains",
                    "value": "unibet.com"
                },
                {
                    "condition": "AND",
                    "rules": [
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "Unibet"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "Online Betting and Live Betting"
                        }
                    ]
                }
            ]
        },
        winline: {
            "condition": "OR",
            "rules": [
                {
                    "id": "href",
                    "operator": "contains",
                    "value": "winline."
                },
                {
                    "condition": "AND",
                    "rules": [
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "Винлайн"
                        },
                        {
                            "condition": "OR",
                            "rules": [
                                {
                                    "id": "title",
                                    "operator": "contains",
                                    "value": "Ставки на спорт онлайн!"
                                },
                                {
                                    "id": "title",
                                    "operator": "contains",
                                    "value": "Онлайн ставки на спорт!"
                                }
                            ]
                        }
                    ]
                }
            ],
        },
        onexbet: {
            "condition": "OR",
            "rules": [
                {
                    "id": "href",
                    "operator": "contains",
                    "value": "pay.1cupis.ru/refill"
                },
                {
                    "condition": "OR",
                    "rules": [
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "1xBET"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "1XBET"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "1xbet.com"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "1xBet"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "1хбет"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "1xbetua"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "ua1xbet.com"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "1xСтавка"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "1хСтавка"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "1xstavka.ru"
                        },
                        {
                            "id": "title",
                            "operator": "contains",
                            "value": "1xStavka"
                        }
                    ]
                }
            ],
            "valid": true
        },
        fon: {
            "condition": "AND",
            "rules": [
                {
                    "id": "href",
                    "operator": "contains",
                    "value": ".fonbet."
                }
            ],
        },
        bwin: {
            "condition": "AND",
            "rules": [
                {
                    "id": "href",
                    "operator": "contains",
                    "value": ".bwin."
                }
            ],
        }
    };

    $('#builder-basic').queryBuilder({
        filters: [
            {
                id: 'title',
                label: 'Title',
                type: 'string',
                operators: ['contains']
            },
            {
                id: 'href',
                label: 'Href',
                type: 'string',
                operators: ['contains']
            },
        ],

        // rules: rules_basic
    });

    $('#btn-reset').on('click', function () {
        $('#builder-basic').queryBuilder('reset');
    });

    $('#btn-set-leon').on('click', function () {
        $('#builder-basic').queryBuilder('setRules', bkRules.leon);
        console.log(JSON.stringify(bkRules.leon));
    });
    $('#btn-set-unibet').on('click', function () {
        $('#builder-basic').queryBuilder('setRules', bkRules.unibet);
        console.log(JSON.stringify(bkRules.unibet));
    });
    $('#btn-set-winline').on('click', function () {
        $('#builder-basic').queryBuilder('setRules', bkRules.winline);
        console.log(JSON.stringify(bkRules.winline));
    });
    $('#btn-set-onexbet').on('click', function () {
        $('#builder-basic').queryBuilder('setRules', bkRules.onexbet);
        console.log(JSON.stringify(bkRules.onexbet));
    });
    $('#btn-set-fon').on('click', function () {
        $('#builder-basic').queryBuilder('setRules', bkRules.fon);
        console.log(JSON.stringify(bkRules.fon));
    });
    $('#btn-set-bwin').on('click', function () {
        $('#builder-basic').queryBuilder('setRules', bkRules.bwin);
        console.log(JSON.stringify(bkRules.bwin));
    });

    $('#btn-get').on('click', function () {
        var result = $('#builder-basic').queryBuilder('getRules');

        if (!$.isEmptyObject(result)) {
            $('#builder-result').html(JSON.stringify(result, null, 2));
        }
    });
};
if ($('#builder-basic').is(':visible')) {
    debugQuery();
}