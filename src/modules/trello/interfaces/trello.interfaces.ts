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

export interface ITrelloCard {
  cardId: string;
  cardName: string;
  listName: string;
  boardName: string;
  dueDate: string | null;
}
