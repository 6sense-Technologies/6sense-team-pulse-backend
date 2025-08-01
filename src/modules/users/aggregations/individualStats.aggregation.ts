import mongoose, { Types } from 'mongoose';

export const individualStats = (
  userId: string,
  organizationId: string,
  page: Number,
  limit: Number,
) => {
  const startDate =
    new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Dhaka' }).replace(' ', 'T') + '+06:00';

  const indiestatAgg = [
    {
      $match: {
        user: new Types.ObjectId(userId),
        organization: new Types.ObjectId(organizationId),
        issueType: {
          $in: ['Task', 'Story', 'Bug', 'Holiday'],
        },
        date: { $lte: new Date(startDate.split('T')[0]) },
      },
    },
    {
      $densify: {
        field: 'date',
        range: {
          bounds: [new Date('2024-08-01'), new Date(startDate.split('T')[0])],
          step: 1,
          unit: 'day',
        },
      },
    },
    {
      $set: {
        hasIssue: { $ifNull: ['$issueId', false] },
      },
    },
    {
      $sort: { date: -1 }, // Sort by date in ascending order
    },
    {
      $group: {
        _id: '$date',
        comment: { $first: '$comment' },
        hasIssue: { $first: '$hasIssue' },
        // Group by the 'date' field
        doneTaskCountPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Task'],
                  },
                  {
                    $in: [
                      '$issueStatus',
                      [
                        'Done',
                        'In Review',
                        'USER STORIES (Verified In Beta)',
                        'USER STORIES (Verified In Test)',
                        'completed',
                      ],
                    ],
                  },
                  {
                    $eq: ['$planned', true],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        doneTaskCountUnplanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Task'],
                  },
                  {
                    $in: [
                      '$issueStatus',
                      [
                        'Done',
                        'In Review',
                        'USER STORIES (Verified In Beta)',
                        'USER STORIES (Verified In Test)',
                        'completed',
                      ],
                    ],
                  },
                  {
                    $eq: ['$planned', false],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        notDoneTaskCountPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Task'],
                  },
                  {
                    $not: {
                      $in: [
                        '$issueStatus',
                        [
                          'Done',
                          'In Review',
                          'USER STORIES (Verified In Beta)',
                          'USER STORIES (Verified In Test)',
                          'completed',
                        ],
                      ],
                    },
                  },
                  {
                    $eq: ['$planned', true],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        notDoneTaskCountUnplanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Task'],
                  },
                  {
                    $not: {
                      $in: [
                        '$issueStatus',
                        [
                          'Done',
                          'In Review',
                          'USER STORIES (Verified In Beta)',
                          'USER STORIES (Verified In Test)',
                          'completed',
                        ],
                      ],
                    },
                  },
                  {
                    $eq: ['$planned', false],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        doneStoryCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Story'],
                  },
                  {
                    $in: [
                      '$issueStatus',
                      [
                        'Done',
                        'In Review',
                        'USER STORIES (Verified In Beta)',
                        'USER STORIES (Verified In Test)',
                        'completed',
                      ],
                    ],
                  },
                  //   {
                  //     $eq: ['$planned', true],
                  //   },
                ],
              },
              1,
              0,
            ],
          },
        },
        notDoneStoryCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Story'],
                  },
                  {
                    $not: {
                      $in: [
                        '$issueStatus',
                        [
                          'Done',
                          'In Review',
                          'USER STORIES (Verified In Beta)',
                          'USER STORIES (Verified In Test)',
                          'completed',
                        ],
                      ],
                    },
                  },
                  //   {
                  //     $eq: ['$planned', true],
                  //   },
                ],
              },
              1,
              0,
            ],
          },
        },
        doneBugCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Bug'],
                  },
                  {
                    $in: [
                      '$issueStatus',
                      [
                        'Done',
                        'In Review',
                        'USER STORIES (Verified In Beta)',
                        'USER STORIES (Verified In Test)',
                        'completed',
                      ],
                    ],
                  },
                  //   {
                  //     $eq: ['$planned', true],
                  //   },
                ],
              },
              1,
              0,
            ],
          },
        },
        notDoneBugCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Bug'],
                  },
                  {
                    $not: {
                      $in: [
                        '$issueStatus',
                        [
                          'Done',
                          'In Review',
                          'USER STORIES (Verified In Beta)',
                          'USER STORIES (Verified In Test)',
                          'completed',
                        ],
                      ],
                    },
                  },
                  //   {
                  //     $eq: ['$planned', true],
                  //   },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $sort: { _id: -1 },
    },
    {
      $addFields: {
        totalTaskCount: {
          $sum: [
            '$doneTaskCountPlanned',
            '$doneTaskCountUnplanned',
            '$notDoneTaskCountPlanned',
            '$notDoneTaskCountUnplanned',
          ],
        },
        totalTaskPlanned: {
          $sum: ['$doneTaskCountPlanned', '$notDoneTaskCountPlanned'],
        },
        totalTaskUnPlanned: {
          $sum: ['$doneTaskCountUnplanned', '$notDoneTaskCountUnplanned'],
        },
        totalDoneTaskCount: {
          $sum: ['$doneTaskCountPlanned', '$doneTaskCountUnplanned'],
        },
        totalStoryCount: {
          $sum: ['$doneStoryCount', '$notDoneStoryCount'],
        },
        totalBugCount: {
          $sum: ['$doneBugCount', '$notDoneBugCount'],
        },
      },
    },
    {
      $addFields: {
        taskCompletionRate: {
          $cond: [
            {
              $eq: ['$totalTaskCount', 0],
            },
            0,
            {
              $multiply: [
                {
                  $divide: ['$totalDoneTaskCount', '$totalTaskCount'],
                },
                100,
              ],
            },
          ],
        },
        storyCompletionRate: {
          $cond: [
            {
              $eq: ['$totalStoryCount', 0],
            },
            0,
            {
              $multiply: [
                {
                  $divide: ['$doneStoryCount', '$totalStoryCount'],
                },
                100,
              ],
            },
          ],
        },
        codeToBugRatio: {
          $cond: [
            {
              $eq: ['$totalTaskCount', 0],
            },
            0,
            {
              $multiply: [
                {
                  $divide: ['$totalBugCount', '$totalTaskCount'],
                },
                1,
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        score: {
          $multiply: [
            {
              $cond: [
                { $gt: ['$totalTaskCount', 0] },
                {
                  $cond: [
                    {
                      $eq: ['$totalStoryCount', 0],
                    },
                    {
                      $divide: ['$taskCompletionRate', 100],
                    },
                    {
                      $divide: [
                        {
                          $add: [
                            '$taskCompletionRate',
                            {
                              $multiply: ['$storyCompletionRate', 2],
                            },
                          ],
                        },
                        300,
                      ],
                    },
                  ],
                },
                {
                  $divide: ['$storyCompletionRate', 100],
                },
              ],
            },
            100,
          ],
        },
      },
    },
    {
      $addFields: {
        insight: {
          $cond: {
            if: { $eq: ['$hasIssue', false] },
            then: 'holidays/leave',
            else: {
              $cond: {
                if: { $gt: ['$doneTaskCountUnplanned', 0] },
                then: {
                  $concat: [
                    'Your target was ',
                    { $toString: '$doneTaskCountPlanned' },
                    ' but you completed ',
                    {
                      $toString: {
                        $sum: ['$totalDoneTaskCount', '$doneBugCount'],
                      },
                    },
                    '. ',
                    { $toString: '$doneTaskCountUnplanned' },
                    ' tasks that you completed do not match your target issues.',
                  ],
                },
                else: '',
              },
            },
          },
        },
        // insight: {
        //   $cond: {
        //     if: {
        //       $and: [
        //         { $eq: ['$totalTaskPlanned', 0] },
        //         { $eq: ['$totalBugCount', 0] },
        //         { $eq: ['$totalStoryCount', 0] },
        //       ],
        //     },
        //     then: 'holidays/leave',
        //     else: {
        //       $cond: {
        //         if: { $gt: ['$doneTaskCountUnplanned', 0] },
        //         then: {
        //           $concat: [
        //             'Your target was ',
        //             { $toString: '$doneTaskCountPlanned' },
        //             ' but you completed ',
        //             {
        //               $toString: {
        //                 $sum: ['$totalDoneTaskCount', '$doneBugCount'],
        //               },
        //             },
        //             '. ',
        //             { $toString: '$doneTaskCountUnplanned' },
        //             ' tasks that you completed do not match your target issues.',
        //           ],
        //         },
        //         else: '',
        //       },
        //     },
        //   },
        // },
      },
    },
    {
      $facet: {
        total: [{ $count: 'total' }],
        data: [{ $skip: (Number(page) - 1) * Number(limit) }, { $limit: Number(limit) }],
      },
    },
    {
      $unwind: '$total',
    },
    {
      $project: {
        count: '$total.total',
        data: 1,
      },
    },
  ];
  return indiestatAgg;
};
