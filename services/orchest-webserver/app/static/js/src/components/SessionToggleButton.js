import React from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import { makeCancelable, makeRequest, PromiseManager } from "../lib/utils/all";

class SessionToggleButton extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      working: false,
      running: false,
    };

    this.promiseManager = new PromiseManager();
    this.STATUS_POLL_FREQUENCY = 1000;
  }

  onClick(e) {
    e.stopPropagation();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
    clearInterval(this.sessionPollingInterval);
  }

  componentDidMount() {
    this.fetchSessionStatus();
  }

  initializeFetchSessionPolling() {
    clearInterval(this.sessionPollingInterval);

    this.sessionPollingInterval = setInterval(() => {
      this.fetchSessionStatus();
    }, this.STATUS_POLL_FREQUENCY);
  }

  fetchSessionStatus() {
    let fetchSessionPromise = makeCancelable(
      makeRequest(
        "GET",
        `/catch/api-proxy/api/sessions/?project_uuid=${this.props.project_uuid}&pipeline_uuid=${this.props.pipeline_uuid}`
      ),
      this.promiseManager
    );

    fetchSessionPromise.promise.then((response) => {
      let session_details;

      let result = JSON.parse(response);

      if (result.sessions.length > 0) {
        session_details = result.sessions[0];

        if (session_details.status == "RUNNING") {
          this.setState(() => {
            let working = false;
            let running = true;

            this.props.onSessionStateChange(working, running, session_details);

            return {
              working: working,
              running: running,
              session_details,
            };
          });

          clearInterval(this.sessionPollingInterval);
        } else if (session_details.status == "LAUNCHING") {
          this.setState(() => {
            let working = true;
            let running = false;

            this.props.onSessionStateChange(working, running);

            return {
              working: working,
              running: running,
            };
          });

          this.initializeFetchSessionPolling();
        } else if (session_details.status == "STOPPING") {
          this.setState(() => {
            let working = true;
            let running = true;

            this.state.working = working;
            this.state.running = running;

            this.initializeFetchSessionPolling();

            return {
              working: working,
              running: running,
              session_details,
            };
          });
        }
      } else {
        this.setState(() => {
          let working = false;
          let running = false;

          this.props.onSessionStateChange(working, running);

          clearInterval(this.sessionPollingInterval);

          return {
            working: working,
            running: running,
          };
        });
      }

      this.props.onSessionFetch(session_details);
    });
  }

  toggleSession() {
    if (this.state.working) {
      let statusText = "launching";
      if (this.state.running) {
        statusText = "shutting down";
      }
      orchest.alert(
        "Error",
        "Please wait, the pipeline session is still " + statusText + "."
      );
      return;
    }

    if (!this.state.running) {
      // send launch request to API
      let data = {
        pipeline_uuid: this.props.pipeline_uuid,
        project_uuid: this.props.project_uuid,
      };

      this.setState((state, _) => {
        let working = true;
        this.props.onSessionStateChange(working, state.running);
        return {
          working: working,
        };
      });

      let launchPromise = makeCancelable(
        makeRequest("POST", "/catch/api-proxy/api/sessions/", {
          type: "json",
          content: data,
        }),
        this.promiseManager
      );

      launchPromise.promise
        .then((response) => {
          let session_details = JSON.parse(response);

          this.setState(() => {
            let working = false;
            let running = true;

            this.props.onSessionStateChange(working, running, session_details);

            return {
              working: working,
              running: running,
              session_details,
            };
          });
        })
        .catch((e) => {
          if (!e.isCanceled) {
            let error = JSON.parse(e.body);

            if (error.message == "JupyterBuildInProgress") {
              orchest.alert(
                "Error",
                "Cannot start session. A JupyterLab build is still in progress."
              );
            }

            this.setState(() => {
              let working = false;
              let running = false;

              this.props.onSessionStateChange(working, running);

              return {
                working: working,
                running: running,
              };
            });
          }
        });
    } else {
      this.setState((state) => {
        let working = true;

        this.props.onSessionStateChange(working, state.running);
        this.props.onSessionShutdown();

        return {
          working: true,
        };
      });

      let deletePromise = makeCancelable(
        makeRequest(
          "DELETE",
          `/catch/api-proxy/api/sessions/${this.props.project_uuid}/${this.props.pipeline_uuid}`
        ),
        this.promiseManager
      );

      deletePromise.promise
        .then((response) => {
          let result = JSON.parse(response);

          this.setState(() => {
            let working = false;
            let running = false;

            this.props.onSessionStateChange(working, running);

            return {
              working: working,
              running: running,
            };
          });
        })
        .catch((err) => {
          if (!err.isCanceled) {
            console.log(
              "Error during request DELETEing launch to orchest-api."
            );
            console.log(err);

            if (err === undefined || (err && err.isCanceled !== true)) {
              this.setState(() => {
                let working = false;
                let running = true;

                this.props.onSessionStateChange(working, running);

                return {
                  working: working,
                  running: running,
                };
              });
            }
          }
        });
    }
  }

  getPowerButtonClasses() {
    let classes = [
      "mdc-power-button",
      "mdc-button--raised",
      "session-state-button",
    ];

    if (this.props.classNames) {
      classes = classes.concat(this.props.classNames);
    }
    if (this.state.running) {
      classes.push("active");
    }
    if (this.state.working) {
      classes.push("working");
    }

    return classes;
  }

  render() {
    let label = "Start session";

    if (this.state.running && this.state.working) {
      label = "Session stopping...";
    } else if (!this.state.running && this.state.working) {
      label = "Session starting...";
    } else if (this.state.running && !this.state.working) {
      label = "Stop session";
    }

    return (
      <MDCButtonReact
        onClick={this.toggleSession.bind(this)}
        classNames={this.getPowerButtonClasses()}
        label={label}
        icon={this.state.working ? "hourglass_empty" : "power_settings_new"}
      />
    );
  }
}

SessionToggleButton.defaultProps = {
  onSessionStateChange: () => {},
  onSessionFetch: () => {},
  onSessionShutdown: () => {},
};

export default SessionToggleButton;
