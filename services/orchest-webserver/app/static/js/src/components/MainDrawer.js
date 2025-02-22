import React from "react";
import { MDCDrawer } from "@material/drawer";

import { RefManager } from "../lib/utils/all";
import {
  getViewDrawerParentViewName,
  nameToComponent,
} from "../utils/webserver-utils";

class MainDrawer extends React.Component {
  constructor() {
    super();

    this.refManager = new RefManager();
  }

  componentDidMount() {
    this.drawer = new MDCDrawer(this.refManager.refs.mainDrawer);
    this.drawer.list.singleSelection = true;
    this.drawer.open = this.props.open;
    this.drawer.listen("MDCList:action", (e) => {
      let selectedIndex = e.detail.index;

      let listElement = this.drawer.list.listElements[selectedIndex];

      if (listElement.attributes.getNamedItem("data-react-view")) {
        let viewName = listElement.attributes.getNamedItem("data-react-view");
        if (viewName) {
          viewName = viewName.value;
          orchest.loadView(nameToComponent(viewName));
        }
      }
    });

    this.drawer.listen("MDCDrawer:opened", () => {
      document.body.focus();
      orchest.browserConfig.set("topAppBar.open", "true");
    });

    this.drawer.listen("MDCDrawer:closed", () => {
      orchest.browserConfig.set("topAppBar.open", "false");
    });

    // Avoid anchor link clicking default behavior.
    $(".mdc-drawer a[href='#']").on("click", (e) => {
      e.preventDefault();
    });
  }

  close() {
    this.refManager.refs.dialogRef.close();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.selectedElement != this.props.selectedElement) {
      this.setDrawerSelectedElement(this.props.selectedElement);
    }

    // handle drawer open prop
    if (prevProps.open != this.props.open) {
      this.drawer.open = this.props.open;
    }
  }

  setDrawerSelectedElement(viewName) {
    // resolve mapped parent view
    let rootViewName = getViewDrawerParentViewName(viewName);

    let foundRootViewInList = false;

    for (let x = 0; x < this.drawer.list.listElements.length; x++) {
      let listElement = this.drawer.list.listElements[x];

      let elementViewName = listElement.attributes.getNamedItem(
        "data-react-view"
      );

      if (elementViewName) {
        elementViewName = elementViewName.value;

        if (rootViewName === elementViewName) {
          this.drawer.list.selectedIndex = x;
          foundRootViewInList = true;
          break;
        }
      }
    }

    if (!foundRootViewInList) {
      this.drawer.list.selectedIndex = -1;
    }
  }

  render() {
    return (
      <aside
        className="mdc-drawer mdc-drawer--dismissible"
        ref={this.refManager.nrefs.mainDrawer}
      >
        <div className="mdc-drawer__content">
          <nav className="mdc-list">
            <a
              className="mdc-list-item"
              data-react-view="PipelinesView"
              href="#"
            >
              <span className="mdc-list-item__ripple" />
              <i
                className="material-icons mdc-list-item__graphic"
                aria-hidden="true"
              >
                device_hub
              </i>
              <span className="mdc-list-item__text">Pipelines</span>
            </a>
            <a className="mdc-list-item" data-react-view="JobsView" href="#">
              <span className="mdc-list-item__ripple" />
              <i
                className="material-icons mdc-list-item__graphic"
                aria-hidden="true"
              >
                pending_actions
              </i>
              <span className="mdc-list-item__text">Jobs</span>
            </a>
            <a
              className="mdc-list-item"
              data-react-view="EnvironmentsView"
              href="#"
            >
              <span className="mdc-list-item__ripple" />
              <i
                className="material-icons mdc-list-item__graphic"
                aria-hidden="true"
              >
                view_comfy
              </i>
              <span className="mdc-list-item__text">Environments</span>
            </a>
            <li role="separator" className="mdc-list-divider" />
            <a
              className="mdc-list-item"
              data-react-view="FileManagerView"
              href="#"
            >
              <span className="mdc-list-item__ripple" />
              <i
                className="material-icons mdc-list-item__graphic"
                aria-hidden="true"
              >
                folder_open
              </i>
              <span className="mdc-list-item__text">File manager</span>
            </a>
            <a
              className="mdc-list-item mdc-list-item--activated"
              data-react-view="ProjectsView"
              href="#"
            >
              <span className="mdc-list-item__ripple" />
              <i
                className="material-icons mdc-list-item__graphic"
                aria-hidden="true"
              >
                format_list_bulleted
              </i>
              <span className="mdc-list-item__text">Projects</span>
            </a>
          </nav>
        </div>
      </aside>
    );
  }
}

export default MainDrawer;
