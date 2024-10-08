// import { Test, TestingModule } from '@nestjs/testing';
// import { UserService } from './users.service';
// import { getModelToken } from '@nestjs/mongoose';
// import { User } from './schemas/user.schema';
// import { ConflictException, NotFoundException } from '@nestjs/common';
// import { Model } from 'mongoose';
// import { IssueHistory } from './schemas/IssueHistory.schems';
// import { ConfigService } from '@nestjs/config';

// const mockUser = {
//   accountId: '1',
//   displayName: 'John Doe',
//   emailAddress: 'john@example.com',
//   avatarUrls: 'http://example.com/avatar.png',
//   currentPerformance: 0,
//   designation: 'Frontend Developer',
//   isArchive: false,
//   issueHistory: [],
//   toObject: jest.fn().mockReturnValue({
//     accountId: '1',
//     displayName: 'John Doe',
//     emailAddress: 'john@example.com',
//     avatarUrls: 'http://example.com/avatar.png',
//     currentPerformance: 0,
//     designation: 'Frontend Developer',
//     isArchive: false,
//     issueHistory: [],
//   }),
// };

// const mockUserModel = {
//   findOne: jest.fn(),
//   findOneAndDelete: jest.fn(),
//   create: jest.fn().mockResolvedValue(mockUser),
//   countDocuments: jest.fn(),
//   find: jest.fn().mockReturnThis(),
//   sort: jest.fn().mockReturnThis(),
//   skip: jest.fn().mockReturnThis(),
//   limit: jest.fn().mockReturnValue({
//     exec: jest.fn().mockResolvedValue([mockUser]),
//   }),
//   exec: jest.fn(),
// };
// const mockIssueHistoryModel = {
//   findOne: jest.fn(),
//   findOneAndDelete: jest.fn(),
//   create: jest.fn().mockResolvedValue(mockUser),
//   countDocuments: jest.fn(),
//   find: jest.fn().mockReturnThis(),
//   sort: jest.fn().mockReturnThis(),
//   skip: jest.fn().mockReturnThis(),
//   limit: jest.fn().mockReturnValue({
//     exec: jest.fn().mockResolvedValue([mockUser]),
//   }),
//   exec: jest.fn(),
//   findOneAndUpdate:jest.fn(),
// };

// describe('UserService', () => {
//   let userService: UserService;
//   let userModel: Model<User>;
//   let issueHistory: Model<IssueHistory>;
//   let configService: ConfigService;

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         UserService,
//         ConfigService,
//         {
//           provide: getModelToken(User.name),
//           useValue: mockUserModel,
//         },
//         {
//           provide: getModelToken(IssueHistory.name),
//           useValue: mockIssueHistoryModel,
//         },
//       ],
//     }).compile();

//     userService = module.get<UserService>(UserService);
//     configService = module.get<ConfigService>(ConfigService);
//     userModel = module.get<Model<User>>(getModelToken(User.name));
//   });

//   afterEach(() => {
//     jest.clearAllMocks();
//   });

//   describe('getAllUsers', () => {
//     it('should return all users with pagination', async () => {
//       mockUserModel.countDocuments.mockResolvedValue(2);
//       mockUserModel.find.mockReturnValue(mockUserModel);
//       mockUserModel.limit.mockReturnValue({
//         exec: jest.fn().mockResolvedValue([mockUser]),
//       });

//       const result = await userService.getAllUsers(1, 10);

//       expect(result).toEqual({
//         message: 'Users found successfully',
//         statusCode: 200,
//         users: [mockUser],
//         totalPages: 1,
//         currentPage: 1,
//         totalUsers: 2,
//       });
//     });
//   });

//   describe('getUser', () => {
//     it('should return a user with sorted issue history', async () => {
//       const mockUserWithIssues = {
//         ...mockUser,
//         issueHistory: [
//           { date: '2024-09-24', description: 'Issue 1' },
//           { date: '2024-09-22', description: 'Issue 2' },
//           { date: '2024-09-23', description: 'Issue 3' },
//         ],
//       };

//       mockUserModel.findOne.mockReturnValue({
//         exec: jest.fn().mockResolvedValue(mockUserWithIssues),
//       });

//       const result = await userService.getUser('1', 1, 2);

//       expect(result).toEqual({
//         message: 'User found successfully',
//         statusCode: 200,
//         user: expect.objectContaining({
//           accountId: '1',
//           displayName: 'John Doe',
//           issueHistory: [
//             { date: '2024-09-24', description: 'Issue 1' },
//             { date: '2024-09-23', description: 'Issue 3' },
//           ],
//           totalIssueHistory: 3,
//           currentPage: 1,
//           totalPages: 2,
//         }),
//       });
//     });

//     it('should throw NotFoundException if user does not exist', async () => {
//       mockUserModel.findOne.mockReturnValue({
//         exec: jest.fn().mockResolvedValue(null),
//       });

//       await expect(userService.getUser('1')).rejects.toThrow(NotFoundException);
//     });
//   });

//   describe('deleteUser', () => {
//     it('should delete a user successfully', async () => {
//       mockUserModel.findOne.mockResolvedValue(mockUser);
//       mockUserModel.findOneAndDelete.mockResolvedValue(mockUser);

//       const result = await userService.deleteUser('1');

//       expect(result).toEqual({
//         message: 'User deleted successfully',
//         statusCode: 200,
//       });
//     });

//     it('should throw NotFoundException if user does not exist', async () => {
//       mockUserModel.findOne.mockResolvedValue(null);

//       await expect(userService.deleteUser('1')).rejects.toThrow(
//         NotFoundException,
//       );
//     });
//   });

//   describe('archiveUser', () => {
//     it('should archive a user successfully', async () => {
//       mockUserModel.findOne.mockResolvedValue({
//         ...mockUser,
//         save: jest.fn().mockResolvedValue(mockUser),
//       });

//       const result = await userService.archiveUser('1');

//       expect(result).toEqual({
//         message: 'User archived successfully',
//         statusCode: 200,
//       });
//     });

//     it('should throw NotFoundException if user does not exist', async () => {
//       mockUserModel.findOne.mockResolvedValue(null);

//       await expect(userService.archiveUser('1')).rejects.toThrow(
//         NotFoundException,
//       );
//     });

//     it('should throw ConflictException if user is already archived', async () => {
//       mockUserModel.findOne.mockResolvedValue({
//         ...mockUser,
//         isArchive: true,
//       });

//       await expect(userService.archiveUser('1')).rejects.toThrow(
//         ConflictException,
//       );
//     });
//   });

//   describe('fetchAndSavePlannedIssues', () => {
//     it('should fetch and save planned issues successfully', async () => {
//       const date = '2024-09-24';
//       const accountId = '1';
//       const userWithIssues = {
//         ...mockUser,
//         issueHistory: [
//           { date: '2024-09-24', notDoneIssues: [{ 
//               issueType: 'Bug', 
//               issueId: 'bug-1', 
//               summary: 'Issue 1', 
//               status: 'Open', 
//               issueLinks: [{ issueId: 'link-1' }] 
//           }] },
//         ],
//       };

//       mockUserModel.findOne.mockReturnValue({
//         exec: jest.fn().mockResolvedValue(userWithIssues),
//       });

//       mockIssueHistoryModel.findOneAndUpdate.mockResolvedValue(mockUser);

//       const result = await userService.fetchAndSavePlannedIssues(accountId, date);

//       expect(result).toEqual({
//         status: 200,
//         message: 'Planned issues have been successfully updated.',
//       });

//       expect(mockIssueHistoryModel.findOneAndUpdate).toHaveBeenCalledWith(
//         { userName: userWithIssues.displayName, accountId: userWithIssues.accountId },
//         {
//           $set: {
//             [`history.${new Date(date).toISOString().split('T')[0]}`]: {
//               issues: [
//                 {
//                   serialNumber: 1,
//                   issueType: 'Bug',
//                   issueId: 'bug-1',
//                   issueSummary: 'Issue 1',
//                   issueStatus: 'Open',
//                   planned: true,
//                   link: 'link-1',
//                 },
//               ],
//             },
//           },
//         },
//         { upsert: true, new: true },
//       );
//     });

//     it('should throw error if user not found', async () => {
//       const date = '2024-09-24';
//       const accountId = '1';

//       mockUserModel.findOne.mockReturnValue({
//         exec: jest.fn().mockResolvedValue(null),
//       });

//       await expect(userService.fetchAndSavePlannedIssues(accountId, date)).rejects.toThrow(
//         Error,
//       );
//     });

//     it('should handle errors thrown during saving', async () => {
//       const date = '2024-09-24';
//       const accountId = '1';
//       const userWithIssues = {
//         ...mockUser,
//         issueHistory: [
//           { date: '2024-09-24', notDoneIssues: [{ 
//               issueType: 'Bug', 
//               issueId: 'bug-1', 
//               summary: 'Issue 1', 
//               status: 'Open', 
//               issueLinks: [{ issueId: 'link-1' }] 
//           }] },
//         ],
//       };

//       mockUserModel.findOne.mockReturnValue({
//         exec: jest.fn().mockResolvedValue(userWithIssues),
//       });

//       mockIssueHistoryModel.findOneAndUpdate.mockRejectedValue(new Error('Database error'));

//       await expect(userService.fetchAndSavePlannedIssues(accountId, date)).rejects.toThrow(
//         Error,
//       );
//     });
//   });
// });
