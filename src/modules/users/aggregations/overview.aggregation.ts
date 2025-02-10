export const overView = (
  date: string,
  page: Number,
  limit: Number,
  filterIds: any[],
): any => {
  console.log('FILTER IDS: ');
  console.log(filterIds);

  return [
    {
      $match: {
        comment: { $ne: 'holidays/leave' },
        date: { $gte: new Date(date) },
        // user: { $in: filterIds },
      },
    },
    {
      $group: {
        _id: {
          user: '$user',
          date: '$date',
        },
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
                      ],
                    ],
                  },
                  {
                    $eq: ['$planned', false],
                  },
                  // Corrected date filter
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
                      ],
                    ],
                  },
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
                        ],
                      ],
                    },
                  },
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
      $addFields: {
        totalTaskCount: {
          $sum: [
            '$doneTaskCountPlanned',
            '$doneTaskCountUnplanned',
            '$notDoneTaskCountPlanned',
            '$notDoneTaskCountUnplanned',
          ],
        },
        totalDoneTaskCount: {
          $sum: ['$doneTaskCountPlanned', '$doneTaskCountUnplanned'],
        },
        totalStoryCount: { $sum: ['$doneStoryCount', '$notDoneStoryCount'] },
      },
    },
    {
      $addFields: {
        taskCompletionRate: {
          $cond: [
            { $eq: ['$totalTaskCount', 0] },
            0,
            { $divide: ['$totalDoneTaskCount', '$totalTaskCount'] },
          ],
        },
        storyCompletionRate: {
          $cond: [
            { $eq: ['$totalStoryCount', 0] },
            0,
            { $divide: ['$doneStoryCount', '$totalStoryCount'] },
          ],
        },
      },
    },
    {
      $addFields: {
        performance: {
          $multiply: [
            {
              $cond: [
                { $gt: ['$totalTaskCount', 0] },
                {
                  $cond: [
                    { $eq: ['$totalStoryCount', 0] },
                    '$taskCompletionRate',
                    {
                      $divide: [
                        {
                          $add: [
                            '$taskCompletionRate',
                            { $multiply: ['$storyCompletionRate', 2] },
                          ],
                        },
                        3,
                      ],
                    },
                  ],
                },
                '$storyCompletionRate',
              ],
            },
            100,
          ],
        },
      },
    },
    {
      $group: {
        _id: '$_id.user',
        performance: { $avg: '$performance' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userData',
      },
    },
    {
      $unwind: '$userData',
    },
    {
      $project: {
        displayName: '$userData.displayName',
        emailAddress: '$userData.emailAddress',
        designation: '$userData.designation',
        avatarUrls: '$userData.avatarUrls',
        role: 'Member',
        performance: 1,
      },
    },
    {
      $sort: {
        displayName: 1,
        designation: 1,
      },
    },
    {
      $match: {
        _id: { $in: filterIds },
      },
    },
    {
      $facet: {
        total: [{ $count: 'total' }],
        data: [
          { $skip: (Number(page) - 1) * Number(limit) },
          { $limit: Number(limit) },
        ],
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
};
