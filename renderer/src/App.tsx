import * as React from "react";
import { HashRouter as Router, Switch, Route } from "react-router-dom";
import Login from "./components/Login";
import SpotifyController from "./components/SpotifyController";
import "./app.scss";

const App = () => (
  <div style={{ margin: 0, padding: 0 }}>
    <Router>
      <Switch>
        <Route path="/spotify">
          <SpotifyController />
        </Route>
        <Route path="/">
          <Login />
        </Route>
      </Switch>
    </Router>
  </div>
);

export default App;
