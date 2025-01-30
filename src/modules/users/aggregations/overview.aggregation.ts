export const overView = (date: string, page: Number, limit: Number) => {
  return [
    {
      $match: {
        comment: {
          $ne: 'holidays/leave',
        },
        date: {
          $gte: new Date(date),
        },
      },
    },
    {
      $group: {
        _id: '$user',
        doneTaskCountPlanned: {
          $sum: {
            $cond: [
              {
                $and: [
                  {
                    $eq: ['$issueType', 'Task'],
                  },
                  {
                    $in: ['$issueStatus', ['Done', 'In Review']],
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
                    $in: ['$issueStatus', ['Done', 'In Review']],
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
                      $in: ['$issueStatus', ['Done', 'In Review']],
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
                      $in: ['$issueStatus', ['Done', 'In Review']],
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
                    $in: ['$issueStatus', ['Done', 'In Review']],
                  },
                  // {
                  //   $eq: ['$planned', true],
                  // },
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
                      $in: ['$issueStatus', ['Done', 'In Review']],
                    },
                  },
                  // {
                  //   $eq: ['$planned', true],
                  // },
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
                    $in: ['$issueStatus', ['Done', 'In Review']],
                  },
                  // {
                  //   $eq: ['$planned', true],
                  // },
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
                      $in: ['$issueStatus', ['Done', 'In Review']],
                    },
                  },
                  // {
                  //   $eq: ['$planned', true],
                  // },
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
        totalNotDoneTaskCount: {
          $sum: ['$notDoneTaskCountPlanned', '$notDoneTaskCountUnplanned'],
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
            1,
            {
              $multiply: [
                {
                  $divide: ['$totalDoneTaskCount', '$totalTaskCount'],
                },
                1,
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
                1,
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
        performence: {
          $multiply: [
            {
              $divide: [
                {
                  $add: [
                    {
                      $multiply: ['$taskCompletionRate', 1],
                    },
                    {
                      $multiply: ['$storyCompletionRate', 2],
                    },
                  ],
                },
                3,
              ],
            },
            100,
          ],
        },
      },
    },
    {
      $sort: {
        date: 1,
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
        // taskCompletionRate: 1,
        // storyCompletionRate: 1,
        // codeToBugRatio: 1,
        performence: 1,
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


