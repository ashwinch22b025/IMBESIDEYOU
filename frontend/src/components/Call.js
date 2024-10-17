// frontend/src/components/Call.js
import React, { useEffect, useRef, useState, useCallback } from "react";
import io from "socket.io-client";
import {
  Box,
  Flex,
  Text,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { ChatState } from "../Context/ChatProvider";

const Call = ({ chatId, onClose }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [caller, setCaller] = useState(null);
  const [isCallAnswered, setIsCallAnswered] = useState(false);
  const [offer, setOffer] = useState(null); // State to store the offer

  const { isOpen, onOpen, onClose: onCloseModal } = useDisclosure();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef();
  const toast = useToast();
  const { user, selectedChat } = ChatState();
  
const hangUp = () => {
  if (peerConnection) {
    peerConnection.close();
    setPeerConnection(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallAnswered(false);

    // Emit a 'leave-call' event to the server
    socketRef.current.emit("leave-call", {
      chatId: chatId,
    });

    onClose(); // Close the call window
  }
};
  useEffect(() => {
    socketRef.current = io("http://localhost:5000"); // Replace with your backend address

    // Event listener for incoming call
    const handleCallInitiated = (callData) => {
		 console.log("Call initiated received:", callData); // Log the received call data
      if (
        callData.receiverId === user._id &&
        callData.chatId === chatId &&
        !isCallAnswered
      ) {
        setCaller(callData.caller);
        setOffer(callData.offer); // Store the offer
        onOpen(); // Open the modal
      }
    };

    socketRef.current.on("call-initiated", handleCallInitiated);

    // Event listener for call answered
    const handleCallAnswered = () => {
      setIsCallAnswered(true);
    };

    socketRef.current.on("call-answered", handleCallAnswered);

    // Event listener for call rejected
    const handleCallRejected = () => {
      toast({
        title: "Call Rejected",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "bottom",
      });
      onClose(); // Close the call window
    };

    socketRef.current.on("call-rejected", handleCallRejected);

    const handleIceCandidate = (candidate) => {
      if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    socketRef.current.on("ice-candidate", handleIceCandidate);

    socketRef.current.on("user-left-call", () => {
      // Handle the case where the other user left the call
      hangUp();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off("call-initiated", handleCallInitiated);
        socketRef.current.off("call-answered", handleCallAnswered);
        socketRef.current.off("call-rejected", handleCallRejected);
        socketRef.current.off("ice-candidate", handleIceCandidate);
        socketRef.current.off("user-left-call");
        socketRef.current.disconnect();
      }
    };
  }, [chatId, user, isCallAnswered, onOpen, onClose, toast, peerConnection, hangUp]); // Added peerConnection and hangUp as dependencies
  
  useEffect(() => {
    // This effect runs when isCallAnswered changes
    if (isCallAnswered) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          setLocalStream(stream);
          localVideoRef.current.srcObject = stream;
          createPeerConnection();
        })
        .catch((error) => {
          console.error("Error accessing media devices:", error);
          toast({
            title: "Error accessing media devices",
            description: error.message,
            status: "error",
            duration: 5000,
            isClosable: true,
            position: "bottom",
          });
          onClose();
        });
    }
  }, [isCallAnswered, onClose, toast]);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit(
          "ice-candidate",
          event.candidate,
          caller._id,
          chatId
        );
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    setPeerConnection(pc);

    if (offer) {
      // If there's an offer, we're receiving a call
      handleOffer(offer, pc);
    } else {
      // Otherwise, we're initiating a call
      sendOffer(pc);
    }
  };

  const sendOffer = async (pc) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Emit the offer to the server
      socketRef.current.emit("call-initiated", {
        callerId: user._id,
        receiverId: selectedChat.users.find((u) => u._id !== user._id)._id,
        chatId: chatId,
        offer,
      });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  const handleOffer = async (offer, pc) => {
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Emit the answer to the server
      socketRef.current.emit("call-answered", {
        callerId: caller._id,
        receiverId: user._id,
        chatId: chatId,
        answer,
      });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  };

  const answerCall = () => {
    setIsCallAnswered(true);
    onCloseModal(); // Close the modal
  };

  const rejectCall = () => {
    // Emit a call-rejected event to the server
    socketRef.current.emit("call-rejected", {
      callerId: caller._id,
      receiverId: user._id,
      chatId: chatId,
    });
    onCloseModal(); // Close the modal
    onClose(); // Close the call window
  };

  const toggleAudioMute = () => {
    if (localStream) {
      localStream.getAudioTracks()[0].enabled = !isAudioMuted;
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideoMute = () => {
    if (localStream) {
      localStream.getVideoTracks()[0].enabled = !isVideoMuted;
      setIsVideoMuted(!isVideoMuted);
    }
  };


return (
    <Flex direction="column" h="100%" w="100%">
      <Flex
        justifyContent="space-between"
        alignItems="center"
        bg="white"
        p="5px 10px 5px 10px"
        borderWidth="5px"
      >
        <Box>
          <Flex>
            <Button
              onClick={toggleAudioMute}
              mr={2}
              bg={isAudioMuted ? "red.400" : "gray.400"}
            >
              {isAudioMuted ? "Unmute Audio" : "Mute Audio"}
            </Button>
            <Button
              onClick={toggleVideoMute}
              mr={2}
              bg={isVideoMuted ? "red.400" : "gray.400"}
            >
              {isVideoMuted ? "Unmute Video" : "Mute Video"}
            </Button>
            <Button colorScheme="red" onClick={hangUp}>
              End Call
            </Button>
          </Flex>
        </Box>
      </Flex>

      <Flex
        flex={1}
        justifyContent="center"
        alignItems="center"
        bg="gray.200"
      >
        <video ref={localVideoRef} autoPlay muted />
        {remoteStream && <video ref={remoteVideoRef} autoPlay />} {/* Render remote video only if remoteStream is available */}
      </Flex>

      {/* Incoming call modal */}
      <Modal isOpen={isOpen} onClose={onCloseModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Incoming Call</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {caller && <Text>Call from {caller.name}</Text>} {/* Display caller's name if available */}
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="green" mr={3} onClick={answerCall}>
              Answer
            </Button>
            <Button variant="ghost" onClick={rejectCall}>
              Decline
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
};

export default Call;