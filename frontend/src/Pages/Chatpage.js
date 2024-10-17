import { Box, Tab, TabList, Tabs } from "@chakra-ui/react";
import { useState } from "react";
import Chatbox from "../components/Chatbox";
import MyChats from "../components/MyChats";
import SideDrawer from "../components/miscellaneous/SideDrawer";
import { ChatState } from "../Context/ChatProvider";

const Chatpage = () => {
  const [fetchAgain, setFetchAgain] = useState(false);
  const { user } = ChatState();
  const [activeTab, setActiveTab] = useState("userChat");

  return (
    <div style={{ width: "100%" }}>
      {user && <SideDrawer />}
      <Box d="flex" flexDirection="column" w="100%" h="91.5vh" p="10px">
        <Tabs isLazy onChange={(index) => setActiveTab(index === 0 ? "userChat" : "aiChat")}>
          <TabList>
            <Tab>User Chat</Tab>
          </TabList>

          <Box d={activeTab === "userChat" ? "flex" : "none"} justifyContent="space-between" w="100%" h="100%">
            {user && <MyChats fetchAgain={fetchAgain} />}
            {user && (
              <Chatbox fetchAgain={fetchAgain} setFetchAgain={setFetchAgain} />
            )}
          </Box>
        </Tabs>
      </Box>
    </div>
  );
};

export default Chatpage;