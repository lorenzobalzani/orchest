import React, { Fragment } from "react";

import MDCIconButtonToggleReact from "../lib/mdc-components/MDCIconButtonToggleReact";
import {
  makeRequest,
  makeCancelable,
  PromiseManager,
  RefManager,
} from "../lib/utils/all";
import { checkGate } from "../utils/webserver-utils";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import MDCLinearProgressReact from "../lib/mdc-components/MDCLinearProgressReact";
import MDCDialogReact from "../lib/mdc-components/MDCDialogReact";
import MDCDataTableReact from "../lib/mdc-components/MDCDataTableReact";
import SessionToggleButton from "./SessionToggleButton";
import PipelineView from "../views/PipelineView";

class PipelineList extends React.Component {
  componentWillUnmount() {}

  constructor(props) {
    super(props);

    this.state = {
      loading: true,
      createModal: false,
      pipelinePath: "pipeline",
    };

    this.promiseManager = new PromiseManager();
    this.refManager = new RefManager();
  }

  componentWillUnmount() {
    this.promiseManager.cancelCancelablePromises();
  }

  componentDidMount() {
    this.fetchList(() => {
      this.setState({
        loading: false,
      });
    });

    // set headerbar
    orchest.headerBarComponent.clearPipeline();
  }

  processListData(pipelines) {
    let listData = [];

    for (let pipeline of pipelines) {
      listData.push([
        <span>{pipeline.name}</span>,
        <span>{pipeline.path}</span>,
        <SessionToggleButton
          classNames={["consume-click"]}
          pipeline_uuid={pipeline.uuid}
          project_uuid={this.props.project_uuid}
        />,
      ]);
    }

    return listData;
  }

  fetchList(onComplete) {
    // initialize REST call for pipelines
    let fetchListPromise = makeCancelable(
      makeRequest("GET", `/async/pipelines/${this.props.project_uuid}`),
      this.promiseManager
    );

    fetchListPromise.promise.then((response) => {
      let data = JSON.parse(response);
      this.setState({
        listData: this.processListData(data.result),
        pipelines: data.result,
      });

      if (this.refManager.refs.pipelineListView) {
        this.refManager.refs.pipelineListView.setSelectedRowIds([]);
      }

      onComplete();
    });
  }

  openPipeline(pipeline, readOnly) {
    // load pipeline view
    let props = {
      queryArgs: {
        pipeline_uuid: pipeline.uuid,
        project_uuid: this.props.project_uuid,
      },
    };

    if (readOnly) {
      props.queryArgs.read_only = "true";
    }

    orchest.loadView(PipelineView, props);
  }

  onClickListItem(row, idx, e) {
    let pipeline = this.state.pipelines[idx];

    let checkGatePromise = checkGate(this.props.project_uuid);
    checkGatePromise
      .then(() => {
        this.openPipeline(pipeline, false);
      })
      .catch((result) => {
        this.openPipeline(pipeline, true);
      });
  }

  onDeleteClick() {
    let selectedIndices = this.refManager.refs.pipelineListView.getSelectedRowIndices();

    if (selectedIndices.length === 0) {
      orchest.alert("Error", "You haven't selected a pipeline.");
      return;
    }

    orchest.confirm(
      "Warning",
      "Are you certain that you want to delete this pipeline? (This cannot be undone.)",
      () => {
        this.setState({
          loading: true,
        });

        selectedIndices.forEach((index) => {
          let pipeline_uuid = this.state.pipelines[index].uuid;

          // deleting the pipeline will also take care of running
          // sessions, runs, jobs
          makeRequest(
            "DELETE",
            `/async/pipelines/delete/${this.props.project_uuid}/${pipeline_uuid}`
          ).then((_) => {
            // reload list once removal succeeds
            this.fetchList(() => {
              this.setState({
                loading: false,
              });
            });
          });
        });
      }
    );
  }

  onCreateClick() {
    this.setState({
      createModal: true,
    });
  }

  componentDidUpdate(prevProps, prevState, snapshot) {}

  onSubmitModal() {
    let pipelineName = this.refManager.refs.createPipelineNameTextField.mdc
      .value;
    let pipelinePath = this.refManager.refs.createPipelinePathField.mdc.value;

    if (!pipelineName) {
      orchest.alert("Error", "Please enter a name.");
      return;
    }

    if (!pipelinePath) {
      orchest.alert("Error", "Please enter the path for the pipeline.");
      return;
    }

    if (!pipelinePath.endsWith(".orchest")) {
      orchest.alert("Error", "The path should end in the .orchest extension.");
      return;
    }

    this.setState({
      loading: true,
    });

    let createPipelinePromise = makeCancelable(
      makeRequest(
        "POST",
        `/async/pipelines/create/${this.props.project_uuid}`,
        {
          type: "json",
          content: {
            name: pipelineName,
            pipeline_path: pipelinePath,
          },
        }
      ),
      this.promiseManager
    );

    createPipelinePromise.promise
      .then((_) => {
        // reload list once creation succeeds
        this.fetchList(() => {
          this.setState({
            loading: false,
          });
        });
      })
      .catch((response) => {
        if (!e.isCanceled) {
          try {
            let data = JSON.parse(response.body);
            orchest.alert(
              "Error",
              "Could not create pipeline. " + data.message
            );
          } catch {
            orchest.alert(
              "Error",
              "Could not create pipeline. Reason unknown."
            );
          }

          this.setState({
            loading: false,
          });
        }
      });

    this.setState({
      createModal: false,
    });
  }

  onCancelModal() {
    this.refManager.refs.createPipelineDialog.close();
  }

  onCloseCreatePipelineModal() {
    this.setState({
      createModal: false,
      pipelinePath: "pipeline",
    });
  }

  handleInputChange(value) {
    // Create slug.
    this.setState({ pipelinePath: value.toLowerCase().replace(/[\W]/g, "_") });
  }

  render() {
    if (!this.state.loading) {
      return (
        <div className={"pipelines-view"}>
          {(() => {
            if (this.state.createModal) {
              return (
                <MDCDialogReact
                  title="Create a new pipeline"
                  onClose={this.onCloseCreatePipelineModal.bind(this)}
                  ref={this.refManager.nrefs.createPipelineDialog}
                  content={
                    <Fragment>
                      <MDCTextFieldReact
                        ref={this.refManager.nrefs.createPipelineNameTextField}
                        classNames={["fullwidth push-down"]}
                        label="Pipeline name"
                        onChange={this.handleInputChange.bind(this)}
                      />
                      <MDCTextFieldReact
                        ref={this.refManager.nrefs.createPipelinePathField}
                        classNames={["fullwidth"]}
                        label="Pipeline path"
                        value={this.state.pipelinePath + ".orchest"}
                      />
                    </Fragment>
                  }
                  actions={
                    <Fragment>
                      <MDCButtonReact
                        icon="close"
                        label="Cancel"
                        classNames={["push-right"]}
                        onClick={this.onCancelModal.bind(this)}
                      />
                      <MDCButtonReact
                        icon="add"
                        classNames={["mdc-button--raised", "themed-secondary"]}
                        label="Create pipeline"
                        submitButton
                        onClick={this.onSubmitModal.bind(this)}
                      />
                    </Fragment>
                  }
                />
              );
            }
          })()}

          <h2>Pipelines</h2>
          <div className="push-down">
            <MDCButtonReact
              classNames={["mdc-button--raised", "themed-secondary"]}
              icon="add"
              label="Create pipeline"
              onClick={this.onCreateClick.bind(this)}
            />
          </div>
          <div className={"pipeline-actions push-down"}>
            <MDCIconButtonToggleReact
              icon="delete"
              tooltipText="Delete pipeline"
              onClick={this.onDeleteClick.bind(this)}
            />
          </div>

          <MDCDataTableReact
            ref={this.refManager.nrefs.pipelineListView}
            selectable
            onRowClick={this.onClickListItem.bind(this)}
            classNames={["fullwidth"]}
            headers={["Pipeline", "Path", "Session"]}
            rows={this.state.listData}
          />
        </div>
      );
    } else {
      return (
        <div className={"pipelines-view"}>
          <h2>Pipelines</h2>
          <MDCLinearProgressReact />
        </div>
      );
    }
  }
}

export default PipelineList;
