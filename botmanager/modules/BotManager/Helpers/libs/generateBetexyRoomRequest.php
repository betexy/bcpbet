<?php

if (!function_exists('generateBetexyRoomRequest')) {
    /**
     * @throws \yii\web\BadRequestHttpException
     */
    function generateBetexyRoomRequest(array $params): array
    {
        $fields = ['name', 'login', 'password', 'proxy_id', 'comment',];
        $errors = [];
        foreach ($fields as $field) {
            if (empty($params[$field])) {
                $errors[] = "Field {$field} is empty!";
            }
        }
        if (!empty($errors)) {
            throw new \yii\web\BadRequestHttpException(implode('; ', $errors));
        }
        return [

            "id" => null,
            "name" => $params['name'],
            "currency" => "USD",
            "login" => $params['login'],
            "bookmaker" => "STAKE",
            "bk_mirror" => "",
            "password" => $params['password'],
            "proxy_id" => $params['proxy_id'],
            "comment" => $params['comment'],
            "balance_deposit_notification" => null,
            "balance_withdraw_notification" => null,
            "manual_timetable" => 0,
            "leagues_include" => 0,
            "settings" => [
                "FOOTBALL" => [
                    "active" => true,
                    "coef_from" => 1.5,
                    "coef_to" => 2.4,
                    "full_time_only" => false,
                    "not_bet_junior" => false,
                    "not_bet_woman" => false,
                    "markets" => [
                        "ONE_TWO" => [
                            "ONE" => [
                                "active" => true
                            ],
                            "TWO" => [
                                "active" => true
                            ],
                            "ONE_TWO" => [
                                "active" => true
                            ],
                            "DRAW" => [
                                "active" => true
                            ],
                            "ONE_DRAW" => [
                                "active" => true
                            ],
                            "TWO_DRAW" => [
                                "active" => true
                            ]
                        ],
                        "TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T1_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T2_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "HDP" => [
                            "HOME" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "AWAY" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "EURO_HDP" => [
                            "H1" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "H2" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "HX" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "CORNER_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "CORNER_HDP" => [
                            "HOME" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "AWAY" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ]
                    ]
                ],
                "TENNIS" => [
                    "active" => true,
                    "coef_from" => 1.5,
                    "coef_to" => 2.4,
                    "full_time_only" => false,
                    "not_bet_junior" => false,
                    "not_bet_woman" => false,
                    "markets" => [
                        "ONE_TWO" => [
                            "ONE" => [
                                "active" => true
                            ],
                            "TWO" => [
                                "active" => true
                            ],
                            "ONE_TWO" => [
                                "active" => true
                            ],
                            "DRAW" => [
                                "active" => true
                            ],
                            "ONE_DRAW" => [
                                "active" => true
                            ],
                            "TWO_DRAW" => [
                                "active" => true
                            ]
                        ],
                        "TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T1_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T2_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "HDP" => [
                            "HOME" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "AWAY" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "EURO_HDP" => [
                            "H1" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "H2" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "HX" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ]
                    ]
                ],
                "HOCKEY" => [
                    "active" => true,
                    "coef_from" => 1.5,
                    "coef_to" => 2.4,
                    "full_time_only" => false,
                    "not_bet_junior" => false,
                    "not_bet_woman" => false,
                    "markets" => [
                        "ONE_TWO" => [
                            "ONE" => [
                                "active" => true
                            ],
                            "TWO" => [
                                "active" => true
                            ],
                            "ONE_TWO" => [
                                "active" => true
                            ],
                            "DRAW" => [
                                "active" => true
                            ],
                            "ONE_DRAW" => [
                                "active" => true
                            ],
                            "TWO_DRAW" => [
                                "active" => true
                            ]
                        ],
                        "TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T1_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T2_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "HDP" => [
                            "HOME" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "AWAY" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "EURO_HDP" => [
                            "H1" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "H2" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "HX" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ]
                    ]
                ],
                "BASKETBALL" => [
                    "active" => true,
                    "coef_from" => 1.5,
                    "coef_to" => 2.4,
                    "full_time_only" => false,
                    "not_bet_junior" => false,
                    "not_bet_woman" => false,
                    "markets" => [
                        "ONE_TWO" => [
                            "ONE" => [
                                "active" => true
                            ],
                            "TWO" => [
                                "active" => true
                            ],
                            "ONE_TWO" => [
                                "active" => true
                            ],
                            "DRAW" => [
                                "active" => true
                            ],
                            "ONE_DRAW" => [
                                "active" => true
                            ],
                            "TWO_DRAW" => [
                                "active" => true
                            ]
                        ],
                        "TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T1_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T2_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "HDP" => [
                            "HOME" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "AWAY" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "EURO_HDP" => [
                            "H1" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "H2" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "HX" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ]
                    ]
                ],
                "VOLLEYBALL" => [
                    "active" => true,
                    "coef_from" => 1.5,
                    "coef_to" => 2.4,
                    "full_time_only" => false,
                    "not_bet_junior" => false,
                    "not_bet_woman" => false,
                    "markets" => [
                        "ONE_TWO" => [
                            "ONE" => [
                                "active" => true
                            ],
                            "TWO" => [
                                "active" => true
                            ],
                            "ONE_TWO" => [
                                "active" => true
                            ],
                            "DRAW" => [
                                "active" => true
                            ],
                            "ONE_DRAW" => [
                                "active" => true
                            ],
                            "TWO_DRAW" => [
                                "active" => true
                            ]
                        ],
                        "TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T1_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T2_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "HDP" => [
                            "HOME" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "AWAY" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "EURO_HDP" => [
                            "H1" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "H2" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "HX" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ]
                    ]
                ],
                "HANDBALL" => [
                    "active" => true,
                    "coef_from" => 1.5,
                    "coef_to" => 2.4,
                    "full_time_only" => false,
                    "not_bet_junior" => false,
                    "not_bet_woman" => false,
                    "markets" => [
                        "ONE_TWO" => [
                            "ONE" => [
                                "active" => true
                            ],
                            "TWO" => [
                                "active" => true
                            ],
                            "ONE_TWO" => [
                                "active" => true
                            ],
                            "DRAW" => [
                                "active" => true
                            ],
                            "ONE_DRAW" => [
                                "active" => true
                            ],
                            "TWO_DRAW" => [
                                "active" => true
                            ]
                        ],
                        "TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T1_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T2_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "HDP" => [
                            "HOME" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "AWAY" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "EURO_HDP" => [
                            "H1" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "H2" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "HX" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ]
                    ]
                ],
                "BASEBALL" => [
                    "active" => true,
                    "coef_from" => 1.5,
                    "coef_to" => 2.4,
                    "full_time_only" => false,
                    "not_bet_junior" => false,
                    "not_bet_woman" => false,
                    "markets" => [
                        "ONE_TWO" => [
                            "ONE" => [
                                "active" => true
                            ],
                            "TWO" => [
                                "active" => true
                            ],
                            "ONE_TWO" => [
                                "active" => true
                            ],
                            "DRAW" => [
                                "active" => true
                            ],
                            "ONE_DRAW" => [
                                "active" => true
                            ],
                            "TWO_DRAW" => [
                                "active" => true
                            ]
                        ],
                        "TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T1_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T2_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "HDP" => [
                            "HOME" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "AWAY" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "EURO_HDP" => [
                            "H1" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "H2" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "HX" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ]
                    ]
                ],
                "TABLETENNIS" => [
                    "active" => true,
                    "coef_from" => 1.5,
                    "coef_to" => 2.4,
                    "full_time_only" => false,
                    "not_bet_junior" => false,
                    "not_bet_woman" => false,
                    "markets" => [
                        "ONE_TWO" => [
                            "ONE" => [
                                "active" => true
                            ],
                            "TWO" => [
                                "active" => true
                            ],
                            "ONE_TWO" => [
                                "active" => true
                            ],
                            "DRAW" => [
                                "active" => true
                            ],
                            "ONE_DRAW" => [
                                "active" => true
                            ],
                            "TWO_DRAW" => [
                                "active" => true
                            ]
                        ],
                        "TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T1_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T2_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "HDP" => [
                            "HOME" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "AWAY" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "EURO_HDP" => [
                            "H1" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "H2" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "HX" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ]
                    ]
                ],
                "CYBERSPORT" => [
                    "active" => true,
                    "coef_from" => 1.5,
                    "coef_to" => 2.4,
                    "full_time_only" => false,
                    "not_bet_junior" => false,
                    "not_bet_woman" => false,
                    "markets" => [
                        "ONE_TWO" => [
                            "ONE" => [
                                "active" => true
                            ],
                            "TWO" => [
                                "active" => true
                            ],
                            "ONE_TWO" => [
                                "active" => true
                            ],
                            "DRAW" => [
                                "active" => true
                            ],
                            "ONE_DRAW" => [
                                "active" => true
                            ],
                            "TWO_DRAW" => [
                                "active" => true
                            ]
                        ],
                        "TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T1_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "T2_TOTAL" => [
                            "UNDER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "OVER" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "HDP" => [
                            "HOME" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "AWAY" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ],
                        "EURO_HDP" => [
                            "H1" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "H2" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ],
                            "HX" => [
                                "active" => true,
                                "pivot_from" => null,
                                "pivot_to" => null
                            ]
                        ]
                    ]
                ]
            ],
            "leagues" => [],
            "strategies" => [
                [
                    "strategy_id" => 246,
                    "stake1" => "1",
                    "stake2" => "",
                    "stake3" => "",
                    "dynamic_stake" => false,
                    "dynamic_stake_percent" => null,
                    "bets_per_event" => 1,
                    "bets_interval" => 120
                ]
            ],
            "timetable" => [
                "1" => [
                    "1" => true,
                    "2" => true,
                    "3" => true,
                    "4" => true,
                    "5" => true,
                    "6" => true,
                    "7" => true,
                    "8" => true,
                    "9" => true,
                    "10" => true,
                    "11" => true,
                    "12" => true,
                    "13" => true,
                    "14" => true,
                    "15" => true,
                    "16" => true,
                    "17" => true,
                    "18" => true,
                    "19" => true,
                    "20" => true,
                    "21" => true,
                    "22" => true,
                    "23" => true,
                    "24" => true
                ],
                "2" => [
                    "1" => true,
                    "2" => true,
                    "3" => true,
                    "4" => true,
                    "5" => true,
                    "6" => true,
                    "7" => true,
                    "8" => true,
                    "9" => true,
                    "10" => true,
                    "11" => true,
                    "12" => true,
                    "13" => true,
                    "14" => true,
                    "15" => true,
                    "16" => true,
                    "17" => true,
                    "18" => true,
                    "19" => true,
                    "20" => true,
                    "21" => true,
                    "22" => true,
                    "23" => true,
                    "24" => true
                ],
                "3" => [
                    "1" => true,
                    "2" => true,
                    "3" => true,
                    "4" => true,
                    "5" => true,
                    "6" => true,
                    "7" => true,
                    "8" => true,
                    "9" => true,
                    "10" => true,
                    "11" => true,
                    "12" => true,
                    "13" => true,
                    "14" => true,
                    "15" => true,
                    "16" => true,
                    "17" => true,
                    "18" => true,
                    "19" => true,
                    "20" => true,
                    "21" => true,
                    "22" => true,
                    "23" => true,
                    "24" => true
                ],
                "4" => [
                    "1" => true,
                    "2" => true,
                    "3" => true,
                    "4" => true,
                    "5" => true,
                    "6" => true,
                    "7" => true,
                    "8" => true,
                    "9" => true,
                    "10" => true,
                    "11" => true,
                    "12" => true,
                    "13" => true,
                    "14" => true,
                    "15" => true,
                    "16" => true,
                    "17" => true,
                    "18" => true,
                    "19" => true,
                    "20" => true,
                    "21" => true,
                    "22" => true,
                    "23" => true,
                    "24" => true
                ],
                "5" => [
                    "1" => true,
                    "2" => true,
                    "3" => true,
                    "4" => true,
                    "5" => true,
                    "6" => true,
                    "7" => true,
                    "8" => true,
                    "9" => true,
                    "10" => true,
                    "11" => true,
                    "12" => true,
                    "13" => true,
                    "14" => true,
                    "15" => true,
                    "16" => true,
                    "17" => true,
                    "18" => true,
                    "19" => true,
                    "20" => true,
                    "21" => true,
                    "22" => true,
                    "23" => true,
                    "24" => true
                ],
                "6" => [
                    "1" => true,
                    "2" => true,
                    "3" => true,
                    "4" => true,
                    "5" => true,
                    "6" => true,
                    "7" => true,
                    "8" => true,
                    "9" => true,
                    "10" => true,
                    "11" => true,
                    "12" => true,
                    "13" => true,
                    "14" => true,
                    "15" => true,
                    "16" => true,
                    "17" => true,
                    "18" => true,
                    "19" => true,
                    "20" => true,
                    "21" => true,
                    "22" => true,
                    "23" => true,
                    "24" => true
                ],
                "7" => [
                    "1" => true,
                    "2" => true,
                    "3" => true,
                    "4" => true,
                    "5" => true,
                    "6" => true,
                    "7" => true,
                    "8" => true,
                    "9" => true,
                    "10" => true,
                    "11" => true,
                    "12" => true,
                    "13" => true,
                    "14" => true,
                    "15" => true,
                    "16" => true,
                    "17" => true,
                    "18" => true,
                    "19" => true,
                    "20" => true,
                    "21" => true,
                    "22" => true,
                    "23" => true,
                    "24" => true
                ]
            ]
        ];
    }
}
