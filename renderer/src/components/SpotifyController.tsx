import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useLayoutEffect
} from "react";
import { useLocation } from "react-router-dom";
import { IpcRenderer, Shell } from "electron";
import queryString from "querystring";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Minimize2,
  Maximize2,
  Loader
} from "react-feather";

import "./Spotify.scss";

const electron = window.require("electron");
let ipcRenderer: IpcRenderer = electron.ipcRenderer;
let shell: Shell = electron.shell;

const SpotifyController = () => {
  const location = useLocation();
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [refreshToken, setRefreshToken] = useState<string | undefined>();
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const [spotifyWaiting, setSpotifyWaiting] = useState(false);
  const [deviceID, setDeviceID] = useState<string | null>();
  const [large, setLarge] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>();
  const [disallows, setDisallows] = useState<object | undefined>();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const timeOut = useRef<NodeJS.Timeout | undefined>();

  useEffect(() => {
    setDeviceID(localStorage.getItem("deviceID"));
  }, []);

  const getTokens = useCallback(
    async (refresh = false) => {
      refresh && localStorage.removeItem("accessToken");
      const localAccessToken = localStorage.getItem("accessToken");
      console.log("localAccessToken: ", localAccessToken);
      const localRefreshToken = localStorage.getItem("refreshToken");
      if (!refresh && localAccessToken && localRefreshToken) {
        console.log("Found Local Tokens");
        setAccessToken(localAccessToken);
        setRefreshToken(localRefreshToken);
        return;
      }
      const parsed = queryString.parse(location.search);
      const accessCode = parsed["?code"] as string;
      const data = new URLSearchParams();
      if (refresh && refreshToken) {
        data.append("grant_type", "refresh_token");
        data.append("refresh_token", refreshToken);
      } else {
        data.append("grant_type", "authorization_code");
        data.append("code", accessCode);
      }
      data.append("redirect_uri", "http://mysteriumcosmographicum.com/");

      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(
            `${process.env.REACT_APP_CLIENT_ID}:${process.env.REACT_APP_CLIENT_SECRET}`
          )}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: data.toString()
      });

      const { access_token, refresh_token } = await response.json();
      access_token && localStorage.setItem("accessToken", access_token);
      refresh_token && localStorage.setItem("refreshToken", refresh_token);

      setAccessToken(access_token);
      setRefreshToken(refresh_token);
      // removed getCurrentlyPlaying from here???
    },
    [refreshToken, location.search]
  );

  useLayoutEffect(() => {
    getTokens();
  }, [location.search, getTokens]);

  useEffect(() => {
    if (large) {
      ipcRenderer.send("resize", 250, 250);
    } else {
      ipcRenderer.send("resize", 250, 100);
    }
  }, [large]);

  const getCurrentlyPlaying = useCallback(async () => {
    const response = await fetch("https://api.spotify.com/v1/me/player", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (spotifyWaiting || response.status === 204) {
      setTimeout(getCurrentlyPlaying, 5000);
      return;
    }

    if (response.status === 401) {
      const { error } = await response.json();
      if (error.message === "The access token expired") {
        refreshToken && (await getTokens(true));
        return;
      }
      return;
    }

    const {
      item,
      is_playing,
      actions,
      progress_ms,
      device
    } = await response.json();

    if (item) {
      if (spotifyWaiting) {
        setSpotifyWaiting(false);
      }
      setCurrentTrack(item);
      setPlaying(is_playing);
      setDuration(item.duration_ms);
      setProgress(progress_ms);
      setDeviceID(device.id);
      localStorage.setItem("deviceID", device.id);
      actions.disallows && setDisallows(actions.disallows);
    }
  }, [accessToken, spotifyWaiting, getTokens, refreshToken]);

  const control = useCallback(
    async (command: string) => {
      await fetch(`https://api.spotify.com/v1/me/player/${command}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      getCurrentlyPlaying();
    },
    [accessToken, getCurrentlyPlaying]
  );

  const togglePlay = useCallback(async () => {
    const resp = await fetch(
      `https://api.spotify.com/v1/me/player/${playing ? "pause" : "play"}${
        deviceID ? `?device_id=${deviceID}` : ""
      }`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
    if (spotifyWaiting || resp.status === 204) {
      getCurrentlyPlaying();
      return;
    }

    const { error } = await resp.json();
    if (error.message === "Device not found") {
      if (timeOut.current) {
        clearTimeout(timeOut.current);
      }
      setCurrentTrack(undefined);
      setSpotifyOpen(false);
      return;
    }
    getCurrentlyPlaying();
  }, [accessToken, deviceID, getCurrentlyPlaying, playing, spotifyWaiting]);

  useEffect(() => {
    if (accessToken) {
      ipcRenderer.removeAllListeners();
      ipcRenderer.addListener("MediaPlayPause", () => {
        togglePlay();
      });
      ipcRenderer.addListener("MediaNextTrack", () => {
        control("next");
      });
      ipcRenderer.addListener("MediaPreviousTrack", () => {
        control("previous");
      });
    }
  }, [control, togglePlay, accessToken]);

  useEffect(() => {
    accessToken && getCurrentlyPlaying();
  }, [accessToken, getCurrentlyPlaying]);

  useEffect(() => {
    if (timeOut.current) {
      clearTimeout(timeOut.current);
    }
    if (currentTrack) {
      const timeLeft = duration - progress + 1000;
      timeOut.current = setTimeout(getCurrentlyPlaying, timeLeft);
    }
  }, [currentTrack, duration, getCurrentlyPlaying, progress]);

  const openSpotify = useCallback(() => {
    shell.openExternal("spotify:");
    setSpotifyOpen(true);
    setSpotifyWaiting(true);
    setTimeout(getCurrentlyPlaying, 5000);
  }, [getCurrentlyPlaying]);

  return currentTrack ? (
    <>
      {large && (
        <div className="overlay">
          <span>{currentTrack.name}</span>
          <span>{currentTrack.artists[0].name}</span>
        </div>
      )}
      <div
        style={{
          backgroundImage: `url(${currentTrack.album.images[0].url})`
        }}
        className="container"
      >
        <div className="resizeContainer">
          <button id="resizeButton" onClick={() => setLarge(!large)}>
            {large ? (
              <Minimize2 color="#FAFAFA" />
            ) : (
              <Maximize2 color="#FAFAFA" />
            )}
          </button>
        </div>
        <div className="controlsContainer">
          <button
            disabled={disallows && "skipping_prev" in disallows}
            className="control"
            id="back"
            onClick={() => control("previous")}
          >
            <SkipBack />
          </button>
          <button className="control" id="play" onClick={togglePlay}>
            {playing ? <Pause /> : <Play />}
          </button>
          <button className="control" id="next" onClick={() => control("next")}>
            <SkipForward />
          </button>
        </div>
      </div>
    </>
  ) : (
    <div id="loadingContainer">
      <div id="loadingVideoContainer">
        <video autoPlay muted loop id="loadingVideo">
          <source
            src="https://thumbs.gfycat.com/BreakableScentedAlligatorgar-mobile.mp4"
            type="video/mp4"
          />
        </video>
      </div>
      {spotifyOpen ? (
        <button disabled={spotifyWaiting} id="spotifyLink" onClick={togglePlay}>
          <Loader />
        </button>
      ) : (
        <button id="spotifyLink" onClick={openSpotify}>
          OPEN SPOTIFY
        </button>
      )}
    </div>
  );
};

export default SpotifyController;
