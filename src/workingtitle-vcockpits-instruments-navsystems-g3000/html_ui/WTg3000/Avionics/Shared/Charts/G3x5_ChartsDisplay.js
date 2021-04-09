class WT_G3x5_ChartsDisplay {
    /**
     * @param {String} instrumentID
     * @param {WT_PlayerAirplane} airplane
     * @param {WT_NavigraphAPI} navigraphAPI
     */
    constructor(instrumentID, airplane, navigraphAPI) {
        this._airplane = airplane;
        this._navigraphAPI = navigraphAPI;

        this._settingModelID = `${instrumentID}_${WT_G3x5_ChartsDisplay.SETTING_MODEL_ID}`;
        this._scrollEventKey = `${WT_G3x5_ChartsDisplay.SCROLL_EVENT_KEY_PREFIX}_${instrumentID}`;

        this._tempVector2 = new WT_GVector2(0, 0);
        this._tempTransform = new WT_GTransform2();
    }

    /**
     * @readonly
     * @type {String}
     */
    get settingModelID() {
        return this._settingModelID;
    }

    /**
     * The model associated with this charts display.
     * @readonly
     * @type {WT_G3x5_ChartsModel}
     */
    get model() {
        return this._model;
    }

    /**
     * The view associated with this charts display.
     * @readonly
     * @type {WT_G3x5_ChartsView}
     */
    get view() {
        return this._view;
    }

    /**
     * The setting model associated with this charts display.
     * @readonly
     * @type {WT_DataStoreSettingModel}
     */
    get settingModel() {
        return this._settingModel;
    }

    _initView() {
        this.view.setContext({model: this.model});
    }

    _initSettingValues() {
        this._setLightMode(this._lightModeSetting.getValue());
        this._setLightThreshold(this._lightThresholdSetting.getValue());
        this._setSectionMode(this._sectionSetting.getValue());
        this._updateChartRotation();
        this._updateChartZoom();
    }

    _initSettingListeners() {
        this._chartIDSetting.addListener(this._onChartIDSettingChanged.bind(this));
        this._lightModeSetting.addListener(this._onLightModeSettingChanged.bind(this));
        this._lightThresholdSetting.addListener(this._onLightThresholdSettingChanged.bind(this));
        this._sectionSetting.addListener(this._onSectionSettingChanged.bind(this));
        this._rotationSetting.addListener(this._onRotationSettingChanged.bind(this));
        this._zoomSetting.addListener(this._onZoomSettingChanged.bind(this));
        WT_CrossInstrumentEvent.addListener(this._scrollEventKey, this._onScrollEvent.bind(this));
    }

    _initSettingModel() {
        this.settingModel.addSetting(this._chartIDSetting = new WT_G3x5_ChartsChartIDSetting(this.settingModel));
        this.settingModel.addSetting(this._lightModeSetting = new WT_G3x5_ChartsLightModeSetting(this.settingModel));
        this.settingModel.addSetting(this._lightThresholdSetting = new WT_G3x5_ChartsLightThresholdSetting(this.settingModel));
        this.settingModel.addSetting(this._sectionSetting = new WT_G3x5_ChartsSectionSetting(this.settingModel));
        this.settingModel.addSetting(this._rotationSetting = new WT_G3x5_ChartsRotationSetting(this.settingModel));
        this.settingModel.addSetting(this._zoomSetting = new WT_G3x5_ChartsZoomSetting(this.settingModel));

        this._initSettingValues();
        this._initSettingListeners();

        this.settingModel.init();
    }

    _initMapModel() {
        this._mapModel.addModule(new WT_G3x5_MapModelChartsModule());
    }

    _initMapView() {
        this._mapView.addLayer(new WT_G3x5_MapViewChartsAirplaneLayer());
        this._mapView.addLayer(new WT_G3x5_MapViewChartsAirplaneStatusLayer());
    }

    _initMapRangeTargetRotationController() {
        this._mapRangeTargetRotationController = new WT_G3x5_ChartsMapController(this.model, this.view, this._mapModel, this._mapView);
    }

    _initMap(viewElement) {
        this._mapModel = new WT_MapModel(this._airplane);
        this._mapView = viewElement.querySelector(`map-view`);
        this._mapView.setModel(this._mapModel);

        this._initMapModel();
        this._initMapView();
        this._initMapRangeTargetRotationController();
    }

    init(viewElement) {
        this._model = new WT_G3x5_ChartsModel(this._navigraphAPI);
        this._view = viewElement;
        this._settingModel = new WT_DataStoreSettingModel(this.settingModelID);

        this._initView();
        this._initSettingModel();
        this._initMap(viewElement);
    }

    _setLightMode(value) {
        this._lightMode = value;
    }

    _setLightThreshold(value) {
        this._lightThreshold = value;
    }

    _setSectionMode(value) {
        this.model.sectionMode = value;
    }

    _updateChartRotation() {
        this.model.rotation = this._rotationSetting.getRotation();
    }

    _updateChartZoom() {
        this.model.scaleFactor = this._zoomSetting.getScaleFactor();
    }

    _onChartIDSettingChanged(setting, newValue, oldValue) {
        this.model.chartID = newValue;
    }

    _onLightModeSettingChanged(setting, newValue, oldValue) {
        this._setLightMode(newValue);
    }

    _onLightThresholdSettingChanged(setting, newValue, oldValue) {
        this._setLightThreshold(newValue);
    }

    _onSectionSettingChanged(setting, newValue, oldValue) {
        this._setSectionMode(newValue);
    }

    _onRotationSettingChanged(setting, newValue, oldValue) {
        this._updateChartRotation();
    }

    _onZoomSettingChanged(setting, newValue, oldValue) {
        this._updateChartZoom();
    }

    _scrollChart(deltaX, deltaY) {
        if (!this.model.chart) {
            return;
        }

        let transform = this._tempTransform.set(this.view.chartTransformInverse).setTranslate(0, 0);

        let offset = transform.apply(this._tempVector2.set(-deltaX, -deltaY), true).add(this.model.offset);
        let halfWidth = (this.view.chartBounds.right - this.view.chartBounds.left) / 2;
        let halfHeight = (this.view.chartBounds.bottom - this.view.chartBounds.top) / 2;
        let boundedOffsetX = Math.max(-halfWidth, Math.min(halfWidth, offset.x));
        let boundedOffsetY = Math.max(-halfHeight, Math.min(halfHeight, offset.y));
        this.model.offset = offset.set(boundedOffsetX, boundedOffsetY);
    }

    _onScrollEvent(key, data) {
        if (data === WT_G3x5_ChartsDisplay.SCROLL_EVENT_RESET) {
            this.model.offset = this._tempVector2.set(0, 0);
        } else {
            let split = data.split(",");
            let deltaX = parseFloat(split[0]);
            let deltaY = parseFloat(split[1]);
            this._scrollChart(deltaX, deltaY);
        }
    }

    sleep() {
    }

    wake() {
    }

    _getBacklightLevel() {
    }

    _updateLightMode() {
        switch (this._lightMode) {
            case WT_G3x5_ChartsLightModeSetting.Mode.DAY:
                this.model.useNightView = false;
                break;
            case WT_G3x5_ChartsLightModeSetting.Mode.NIGHT:
                this.model.useNightView = true;
                break;
            case WT_G3x5_ChartsLightModeSetting.Mode.AUTO:
                let backlightLevel = this._getBacklightLevel();
                this.model.useNightView = backlightLevel <= this._lightThreshold;
                break;
        }
    }

    update() {
        this._updateLightMode();

        this.view.update();
        this._mapRangeTargetRotationController.update();
        this._mapView.update();
    }
}
WT_G3x5_ChartsDisplay.SETTING_MODEL_ID = "Charts";
WT_G3x5_ChartsDisplay.SCROLL_EVENT_KEY_PREFIX = "WT_Charts_Scroll";
WT_G3x5_ChartsDisplay.SCROLL_EVENT_RESET = "RESET";

class WT_G3x5_ChartsMapController {
    /**
     * @param {WT_G3x5_ChartsModel} chartsModel
     * @param {WT_G3x5_ChartsView} chartsView
     * @param {WT_MapModel} mapModel
     * @param {WT_MapView} mapView
     */
    constructor(chartsModel, chartsView, mapModel, mapView) {
        this._chartsModel = chartsModel;
        this._chartsView = chartsView;
        this._mapModel = mapModel;
        this._mapView = mapView;

        this._geoRef = {
            /**
             * @type {WT_NavigraphChartDefinition}
             */
            chart: null,
            isValid: false,

            /**
             * @type {Number[]}
             */
            geoBounds: null,
            geoAngularWidth: 0,
            geoAngularHeight: 0,
            geoWidth: WT_Unit.GA_RADIAN.createNumber(0),
            geoHeight: WT_Unit.GA_RADIAN.createNumber(0),

            /**
             * @type {Number[]}
             */
            viewBounds: null,
            viewWidth: 0,
            viewHeight: 0,
            viewCenter: new WT_GVector2(0, 0),
        };

        this._tempGARad = WT_Unit.GA_RADIAN.createNumber(0);
        this._tempVector2 = new WT_GVector2(0, 0);
        this._tempGeoPoint = new WT_GeoPoint(0, 0);
    }

    _imgBoundToViewBound(value, index, array) {
        switch (index) {
            case WT_NavigraphChart.BoundsIndex.LEFT:
            case WT_NavigraphChart.BoundsIndex.RIGHT:
                return value - array[WT_NavigraphChart.BoundsIndex.LEFT];
            case WT_NavigraphChart.BoundsIndex.TOP:
            case WT_NavigraphChart.BoundsIndex.BOTTOM:
                return value - array[WT_NavigraphChart.BoundsIndex.TOP];
        }
    }

    _updateChart() {
        this._mapModel.charts.displayedChart = this._chartsModel.chart;
    }

    _updateGeoRef() {
        let chart = this._chartsModel.chart;
        if (!chart || !chart.georef || this._chartsModel.sectionMode !== WT_G3x5_ChartsModel.SectionMode.PLAN || !chart.planview) {
            this._geoRef.isValid = false;
            return;
        }

        if ((this._geoRef.chart && chart.id === this._geoRef.chart.id) && this._geoRef.isValid) {
            return;
        }

        this._geoRef.chart = chart;
        this._geoRef.isValid = true;
        this._geoRef.geoBounds = chart.planview.bbox_geo;

        let deltaLat = chart.planview.bbox_geo[WT_NavigraphChart.BoundsIndex.TOP] - chart.planview.bbox_geo[WT_NavigraphChart.BoundsIndex.BOTTOM];
        let deltaLong = chart.planview.bbox_geo[WT_NavigraphChart.BoundsIndex.RIGHT] - chart.planview.bbox_geo[WT_NavigraphChart.BoundsIndex.LEFT];
        let deltaLatAbs = Math.abs(deltaLat);
        let deltaLongAbs = Math.abs(deltaLong);
        this._geoRef.geoAngularWidth = Math.min(deltaLongAbs, 360 - deltaLongAbs);
        this._geoRef.geoAngularHeight = Math.min(deltaLatAbs, 360 - deltaLatAbs);

        let centerLat = chart.planview.bbox_geo[WT_NavigraphChart.BoundsIndex.BOTTOM] + deltaLat / 2;
        let centerLong = chart.planview.bbox_geo[WT_NavigraphChart.BoundsIndex.LEFT] + deltaLong / 2;
        this._geoRef.geoWidth.set(this._tempGeoPoint.set(centerLat, chart.planview.bbox_geo[WT_NavigraphChart.BoundsIndex.LEFT]).distance(centerLat, chart.planview.bbox_geo[WT_NavigraphChart.BoundsIndex.RIGHT]));
        this._geoRef.geoHeight.set(this._tempGeoPoint.set(chart.planview.bbox_geo[WT_NavigraphChart.BoundsIndex.TOP], centerLong).distance(chart.planview.bbox_geo[WT_NavigraphChart.BoundsIndex.BOTTOM], centerLong));

        this._geoRef.viewBounds = chart.planview.bbox_local.map(this._imgBoundToViewBound.bind(this));
        this._geoRef.viewWidth = chart.planview.bbox_local[WT_NavigraphChart.BoundsIndex.RIGHT] - chart.planview.bbox_local[WT_NavigraphChart.BoundsIndex.LEFT];
        this._geoRef.viewHeight = chart.planview.bbox_local[WT_NavigraphChart.BoundsIndex.BOTTOM] - chart.planview.bbox_local[WT_NavigraphChart.BoundsIndex.TOP];
        this._geoRef.viewCenter.set(this._geoRef.viewWidth / 2, this._geoRef.viewHeight / 2);
    }

    _updateRotation() {
        this._mapModel.rotation = this._chartsModel.rotation;
    }

    _updateTarget() {
        let viewTargetX = this._geoRef.viewCenter.x + this._chartsModel.offset.x;
        let viewTargetY = this._geoRef.viewCenter.y + this._chartsModel.offset.y;

        let geoTargetLat = this._geoRef.geoBounds[WT_NavigraphChart.BoundsIndex.TOP] - viewTargetY / this._geoRef.viewHeight * this._geoRef.geoAngularHeight;
        let geoTargetLong = this._geoRef.geoBounds[WT_NavigraphChart.BoundsIndex.LEFT] + viewTargetX / this._geoRef.viewWidth * this._geoRef.geoAngularWidth;

        this._mapModel.target = this._tempGeoPoint.set(geoTargetLat, geoTargetLong);
    }

    _updateRange() {
        let scaleFactor = this._chartsView.viewHeight / this._chartsView.chartReferenceDisplayHeight / this._chartsModel.scaleFactor;

        this._mapModel.range = this._tempGARad.set(this._geoRef.geoHeight).scale(scaleFactor, true);
    }

    /**
     *
     * @param {{bbox_local:Number[]}[]} insets
     * @param {WT_GVector2} position
     * @returns {Boolean}
     */
     _isInInset(insets, position) {
        return insets.some(inset => {
            return position.x >= inset.bbox_local[WT_NavigraphChart.BoundsIndex.LEFT] &&
                   position.x <= inset.bbox_local[WT_NavigraphChart.BoundsIndex.RIGHT] &&
                   position.y >= inset.bbox_local[WT_NavigraphChart.BoundsIndex.TOP] &&
                   position.y <= inset.bbox_local[WT_NavigraphChart.BoundsIndex.BOTTOM];
        });
    }

    _updateShowAirplane() {
        let show = false;
        if (this._geoRef.isValid) {
            let chartBounds = this._chartsView.chartBounds;
            let chartPos = this._chartsView.chartTransformInverse.apply(this._tempVector2.set(this._mapView.state.viewPlane), true).add(chartBounds.left, chartBounds.top);
            if (chartPos.x >= chartBounds.left && chartPos.x <= chartBounds.right && chartPos.y >= chartBounds.top && chartPos.y <= chartBounds.bottom) {
                show = !this._isInInset(this._chartsModel.chart.insets, chartPos);
            }
        }
        this._mapModel.charts.showAirplane = show;
    }

    update() {
        this._updateChart();
        this._updateGeoRef();
        if (this._geoRef.isValid) {
            this._updateRotation();
            this._updateTarget();
            this._updateRange();
        }
        this._updateShowAirplane();
    }
}