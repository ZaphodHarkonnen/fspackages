class WT_MFD_Direct_To_View extends WT_HTML_View {
    /**
     * @param {WT_Soft_Key_Controller} softKeyController 
     * @param {MapInstrument} map
     * @param {WT_Waypoint_Quick_Select} waypointQuickSelect 
     * @param {WT_Show_Page_Menu_Handler} showPageMenuHandler 
     */
    constructor(softKeyController, map, waypointQuickSelect, showPageMenuHandler) {
        super();
        this.softKeyController = softKeyController;
        this.map = map;
        this.waypointQuickSelect = waypointQuickSelect;
        this.showPageMenuHandler = showPageMenuHandler;
        this.inputLayer = new WT_Direct_To_Input_Layer(this);
        this.userSelectedCourse = false;
    }
    connectedCallback() {
        let template = document.getElementById('direct-to-pane');
        let templateContent = template.content;

        this.appendChild(templateContent.cloneNode(true));

        super.connectedCallback();

        this.elements.mapContainer.appendChild(this.map);
        this.elements.icaoInput.addEventListener("change", e => this.icaoChanged(e.target.icao))
        this.elements.icaoInput.addEventListener("input", DOMUtilities.debounce(e => this.icaoInput(e.target.icao), 500, false))
        this.elements.course.addEventListener("change", e => this.userSelectedCourse = true)
    }
    disconnectedCallback() {
        if (this.closeMenuHandler) {
            this.closeMenuHandler.close();
            this.closeMenuHandler = null;
        }
    }
    icaoInput(icao) {
        this.model.setIcao(icao);
    }
    icaoChanged(icao) {
        this.model.setIcao(icao);
    }
    centerOnCoordinates(coordinates) {
        this.map.setCenter(coordinates, 0);
    }
    /**
     * @param {WT_Direct_To_Model} model 
     */
    setModel(model) {
        this.model = model;
        this.elements.icaoInput.setQuickSelect(this.waypointQuickSelect);
        this.model.waypoint.subscribe(waypoint => {
            if (waypoint) {
                this.elements.icaoInput.icao = waypoint.icao;
                this.centerOnCoordinates(waypoint.infos.coordinates);
            }
        });
        this.model.name.subscribe(name => this.elements.icaoName.innerHTML = `${name === null ? `__________________` : name}`);
        this.model.city.subscribe(city => this.elements.icaoCity.innerHTML = `${city === null ? `__________________` : city}`);
        this.model.bearing.subscribe(bearing => {
            this.elements.bearing.innerHTML = `${bearing === null ? `___` : bearing.toFixed(0)}°`;
            this.userSelectedCourse = false;
            this.elements.course.value = Math.round(bearing);
        });
        this.model.distance.subscribe(distance => this.elements.distance.innerHTML = `${distance === null ? `__._` : distance.toFixed(distance < 100 ? 1 : 0)}<span class="units">NM</span>°`);
    }
    showMenu() {
        this.closeMenuHandler = this.showPageMenuHandler.show(new WT_Direct_To_Page_Menu(this.model));
    }
    enter(inputStack) {
        const mapHandler = inputStack.push(new WT_Map_Input_Layer(this.map, false));
        const inputHandler = inputStack.push(this.inputLayer);
        inputHandler.onPopped.subscribe(() => {
            this.reject();
        })
        this.inputStackHandler = mapHandler;
        this.storedMenu = this.softKeyController.currentMenu;
        this.softKeyController.setMenu(new WT_Soft_Key_Menu());
        return new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
    cancel() {
        this.exit();
    }
    exit() {
        this.inputStackHandler.pop();
        this.softKeyController.setMenu(this.storedMenu);
    }
    hold() {

    }
    activateDirectTo() {
        this.resolve({
            waypoint: this.model.waypoint.value,
            course: this.userSelectedCourse ? this.elements.course.value : null
        });
        this.exit();
    }
}
customElements.define("g1000-direct-to-pane", WT_MFD_Direct_To_View);