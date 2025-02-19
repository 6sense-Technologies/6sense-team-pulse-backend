export const overView = (
  date: string,
  page: Number,
  limit: Number,
  filterIds: any[],
) => {
  console.log('FILTER IDS: ');
  console.log(filterIds);
  const doneCondition = [
    'Done',
    'In Review',
    'USER STORIES (Verified In Beta)',
    'USER STORIES (Verified In Test)',
  ];
  const startDate = new Date(date.split('T')[0]).toISOString();
  const currentDate = new Date().toISOString();
  const endDate = new Date(currentDate.split('T')[0]).toISOString();
  console.log(`Start date: ${startDate}`);
  console.log(`End Date: ${endDate}`);
  return [
    // Pipeline 1: Fetch users who match the $match conditions and calculate performance
    {
      $match: {
        comment: { $ne: 'holidays/leave' },
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
        user: { $in: filterIds },
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
                  { $eq: ['$issueType', 'Task'] },
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
                  { $eq: ['$planned', true] },
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
                  { $eq: ['$issueType', 'Task'] },
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
                  { $eq: ['$planned', false] },
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
                  { $eq: ['$issueType', 'Task'] },
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
                  { $eq: ['$planned', true] },
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
                  { $eq: ['$issueType', 'Task'] },
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
                  { $eq: ['$planned', false] },
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
                  { $eq: ['$issueType', 'Story'] },
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
        _id: '$_id',
        displayName: '$userData.displayName',
        emailAddress: '$userData.emailAddress',
        designation: '$userData.designation',
        avatarUrls: '$userData.avatarUrls',
        isDisabled: { $ifNull: ['$userData.isDisabled', false] },
        role: 'Member',
        performance: 1,
      },
    },

    // Combine with Pipeline 2 using $unionWith
    {
      $unionWith: {
        coll: 'users',
        pipeline: [
          // Pipeline 2: Fetch all users and set performance to 0
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
              isDisabled: { $ifNull: ['$isDisabled', false] },
              role: 'Member',
              performance: { $literal: 0 }, // Default performance to 0
            },
          },
        ],
      },
    },

    // Deduplicate users: Keep users from Pipeline 1 if they exist, otherwise use Pipeline 2
    {
      $group: {
        _id: '$_id',
        displayName: { $first: '$displayName' },
        emailAddress: { $first: '$emailAddress' },
        designation: { $first: '$designation' },
        avatarUrls: { $first: '$avatarUrls' },
        isDisabled: { $first: '$isDisabled' },
        role: { $first: '$role' },
        performance: { $max: '$performance' }, // Use the higher performance value
      },
    },

    // Sort results
    {
      $sort: {
        displayName: 1,
        designation: 1,
      },
    },

    // Paginate results
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
