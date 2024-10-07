export interface ITrelloBoard {
  id: string;
  name: string;
}

export interface ITrelloUsers {
  id: string;
  fullName: string;
  username: string;
  boardId: string;
  boardName: string;
}
