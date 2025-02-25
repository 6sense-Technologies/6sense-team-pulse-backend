import mongoose, { Types } from 'mongoose';
export const getRoles = (teamMember: any, organizationId: string) => {
  return [
    {
      $match: {
        user: { $in: teamMember }, // Match users in the teamMember list
        organization: new mongoose.Types.ObjectId(organizationId), // Match the organizationId
      },
    },
    {
      $lookup: {
        from: 'roles', // Join with the 'roles' collection
        localField: 'role', // Field to match in 'organizationuserroles' (role)
        foreignField: '_id', // Field to match in 'roles' collection (_id)
        as: 'userRole', // Alias for the role details
      },
    },
    {
      $unwind: '$userRole', // Unwind the 'userRole' array to get individual role details
    },
    {
      $project: {
        user: 1, // Include the user field (the user ID)
        roleName: '$userRole.roleName', // Include the roleName from 'userRole'
      },
    },
  ];
};
