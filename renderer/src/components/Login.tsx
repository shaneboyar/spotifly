import React, { useState } from "react";
import { Remote } from "electron";
import * as querystring from "querystring";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpotify } from "@fortawesome/free-brands-svg-icons";
import { Redirect } from "react-router-dom";
import "./Login.scss";

const electron = window.require("electron");
let remote: Remote = electron.remote;

const Application = () => {
  const [accessCode, setAccessCode] = useState<string | undefined>();

  const openLogin = () => {
    const scope = "user-read-playback-state user-modify-playback-state";
    const url = `https://accounts.spotify.com/authorize?${querystring.stringify(
      {
        response_type: "code",
        client_id: process.env.REACT_APP_CLIENT_ID,
        scope,
        redirect_uri: process.env.REACT_APP_REDIRECT_URI
      }
    )}`;

    const loginWindow = new remote.BrowserWindow({
      width: 300,
      height: 800,
      resizable: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: true
      }
    });
    loginWindow.loadURL(url);
    loginWindow.show();
    loginWindow.webContents.on("will-redirect", (event, newUrl) => {
      const parsed = querystring.parse(newUrl);
      const code = parsed[
        "https://mysteriumcosmographicum.com/?code"
      ] as string;
      if (code) {
        loginWindow.close();
        setAccessCode(code);
      }
    });
  };

  if (accessCode) {
    console.log("Got that stanky code.");
    return <Redirect to={`/spotify?code=${accessCode}`} />;
  }

  const localAccessToken = localStorage.getItem("accessToken");
  const localRefreshToken = localStorage.getItem("refreshToken");
  if (localAccessToken && localRefreshToken) {
    console.log("Found Local Tokens, redirecting");
    return <Redirect to="/spotify" />;
  }
  return (
    <div className="container" id="loginContainer">
      <button id="connectButton" onClick={openLogin}>
        <FontAwesomeIcon icon={faSpotify} />
        CONNECT TO SPOTIFY
      </button>
    </div>
  );
};

export default Application;
