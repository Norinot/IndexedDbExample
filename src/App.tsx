import { useEffect } from "react";
import "./App.css";
import { deleteChat, getData, saveData } from "./utils/IndexedDb";

const App = () => {
  useEffect(() => {
    const currentChat = {
      id: generateRandomId(),
      title: "Current Chat",
      message: "This is the current chat message.",
      history: [
        {
          id: generateRandomId(),
          title: "Previous Chat",
          message: "This is a previous chat message.",
        },
      ],
    };

    const chatFromHistory = {
      id: generateRandomId(),
      title: "Chat from History",
      message: "This is a message from history.",
      history: [
        {
          id: generateRandomId(),
          title: "Old Chat",
          message: "An older chat message.",
        },
      ],
    };

    const fetchFromDb = async () => {
      saveData("currentChatHistory", currentChat);
      saveData("chatHistory", chatFromHistory);

      const DataFromHistory = getData("currentChatHistory");

      for (let index = 0; index < 10; index++) {
        const record = {
          ...DataFromHistory,
          message: "Modified message",
          id: generateRandomId(),
        };

        saveData("currentChatHistory", record);
      }

      const deleteThis = await getData("chatHistory");
      if (deleteThis[0]) {
        deleteChat("chatHistory", deleteThis[0].id);
      }
    };

    fetchFromDb();
  }, []);

  const generateRandomId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  };
  return <div>Test</div>;
};

export default App;
