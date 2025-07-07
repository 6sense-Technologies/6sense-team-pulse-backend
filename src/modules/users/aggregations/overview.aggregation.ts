export const overView = (date: string, page: Number, limit: Number, filterIds: any[]) => {
  console.log('FILTER IDS: ', filterIds);
  const startDate = new Date(date.split('T')[0]).toISOString();
  const currentDate = new Date().toISOString();
  const endDate = new Date(currentDate.split('T')[0]).toISOString();
  console.log(`Start date: ${startDate}`);
  console.log(`End Date: ${endDate}`);

  return [
    // Initial match for date range and user IDs
    {
      $match: {
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
        user: { $in: filterIds },
      },
    },

    // Group by date and user to get daily metrics
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          user: '$user',
        },
        dailyDoneTaskPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Task'] },
                  { $eq: ['$planned', true] },
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
                ],
              },
              1,
              0,
            ],
          },
        },
        dailyDoneTaskUnplanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Task'] },
                  { $eq: ['$planned', false] },
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
                ],
              },
              1,
              0,
            ],
          },
        },
        dailyNotDoneTaskPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Task'] },
                  { $eq: ['$planned', true] },
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
                ],
              },
              1,
              0,
            ],
          },
        },
        dailyNotDoneTaskUnplanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Task'] },
                  { $eq: ['$planned', false] },
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
                ],
              },
              1,
              0,
            ],
          },
        },
        dailyDoneStories: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Story'] },
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
                ],
              },
              1,
              0,
            ],
          },
        },
        dailyNotDoneStories: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$issueType', 'Story'] },
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
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },

    // Calculate daily totals and rates
    {
      $addFields: {
        totalTasks: {
          $sum: [
            '$dailyDoneTaskPlanned',
            '$dailyDoneTaskUnplanned',
            '$dailyNotDoneTaskPlanned',
            '$dailyNotDoneTaskUnplanned',
          ],
        },
        totalDoneTasks: {
          $sum: ['$dailyDoneTaskPlanned', '$dailyDoneTaskUnplanned'],
        },
        totalStories: {
          $sum: ['$dailyDoneStories', '$dailyNotDoneStories'],
        },
      },
    },
    {
      $addFields: {
        taskCompletionRate: {
          $cond: [{ $eq: ['$totalTasks', 0] }, 0, { $divide: ['$totalDoneTasks', '$totalTasks'] }],
        },
        storyCompletionRate: {
          $cond: [
            { $eq: ['$totalStories', 0] },
            0,
            { $divide: ['$dailyDoneStories', '$totalStories'] },
          ],
        },
      },
    },

    // Calculate daily performance
    {
      $addFields: {
        dailyPerformance: {
          $multiply: [
            {
              $cond: [
                { $gt: ['$totalTasks', 0] },
                {
                  $cond: [
                    { $eq: ['$totalStories', 0] },
                    '$taskCompletionRate',
                    {
                      $divide: [
                        {
                          $add: ['$taskCompletionRate', { $multiply: ['$storyCompletionRate', 2] }],
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

    // Group by user to get average performance
    {
      $group: {
        _id: '$_id.user',
        avgPerformance: { $avg: '$dailyPerformance' },
      },
    },

    // Lookup user details
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userData',
      },
    },
    {
      $unwind: {
        path: '$userData',
        preserveNullAndEmptyArrays: false, // Ensure we keep users even if no match in users collection
      },
    },

    // Project to ensure user details are included
    {
      $project: {
        _id: 1,
        performance: '$avgPerformance',
        displayName: { $ifNull: ['$userData.displayName', null] },
        emailAddress: { $ifNull: ['$userData.emailAddress', null] },
        designation: { $ifNull: ['$userData.designation', null] },
        avatarUrls: { $ifNull: ['$userData.avatarUrls', null] },
        isDisabled: { $ifNull: ['$userData.isDisabled', false] },
        role: { $literal: 'Member' },
      },
    },

    // Union with users who have no activity
    {
      $unionWith: {
        coll: 'users',
        pipeline: [
          {
            $match: {
              _id: { $in: filterIds },
            },
          },
          {
            $project: {
              _id: 1,
              displayName: 1,
              emailAddress: 1,
              designation: 1,
              avatarUrls: 1,
              avatarUrl: 1,
              isDisabled: { $ifNull: ['$isDisabled', false] },
              role: 'Member',
              performance: { $literal: 0 }, // Changed from avgPerformance to performance for consistency
            },
          },
        ],
      },
    },

    // Deduplicate and ensure first non-null values are kept
    {
      $group: {
        _id: '$_id',
        displayName: {
          $first: {
            $cond: [{ $ne: ['$displayName', null] }, '$displayName', null],
          },
        },
        emailAddress: {
          $first: {
            $cond: [{ $ne: ['$emailAddress', null] }, '$emailAddress', null],
          },
        },
        designation: {
          $first: {
            $cond: [{ $ne: ['$designation', null] }, '$designation', null],
          },
        },
        avatarUrls: {
          $first: {
            $cond: [{ $ne: ['$avatarUrls', null] }, '$avatarUrls', null],
          },
        },
        isDisabled: { $first: '$isDisabled' },
        role: { $first: '$role' },
        performance: { $max: '$performance' },
      },
    },

    // Sort and paginate
    {
      $sort: {
        displayName: 1,
        designation: 1,
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
};
