class WT_FlightPlan {
    /**
     * @param {WT_ICAOWaypointFactory} icaoWaypointFactory
     */
    constructor(icaoWaypointFactory) {
        this._icaoWaypointFactory = icaoWaypointFactory;
        this._procedureLegFactory = new WT_FlightPlanProcedureLegFactory(icaoWaypointFactory);

        this._origin = new WT_FlightPlanOrigin();
        this._origin._setFlightPlan(this);

        this._enroute = new WT_FlightPlanEnroute();
        this._enroute._setFlightPlan(this);
        this._enroute._setPrevious(this._origin);

        this._destination = new WT_FlightPlanDestination();
        this._destination._setFlightPlan(this);
        this._destination._setPrevious(this._enroute);

        /**
         * @type {WT_FlightPlanDeparture}
         */
        this._departure = null;
        /**
         * @type {WT_FlightPlanArrival}
         */
        this._arrival = null;
        /**
         * @type {WT_FlightPlanApproach}
         */
        this._approach = null;

        /**
         * @type {WT_FlightPlanLeg[]}
         */
        this._legs = [];
        this._legsReadOnly = new WT_ReadOnlyArray(this._legs);
        this._totalDistance = new WT_NumberUnit(0, WT_Unit.NMILE);

        this._listeners = [];
    }

    /**
     * @readonly
     * @type {WT_ReadOnlyArray<WT_FlightPlanLeg>}
     */
    get legs() {
        return this._legsReadOnly;
    }

    hasOrigin() {
        return this._origin.waypoint !== null;
    }

    isOriginAirport() {
        return this.hasOrigin() && this._origin.waypoint.icao && this._origin.waypoint.type === WT_ICAOWaypoint.Type.AIRPORT;
    }

    hasDeparture() {
        return this._departure !== null;
    }

    hasArrival() {
        return this._arrival !== null;
    }

    hasApproach() {
        return this._approach !== null;
    }

    hasDestination() {
        return this._destination.waypoint !== null;
    }

    isDestinationAirport() {
        return this.hasDestination() && this._destination.waypoint.icao && this._destination.waypoint.type === WT_ICAOWaypoint.Type.AIRPORT;
    }

    /**
     * @returns {WT_FlightPlanOrigin}
     */
    getOrigin() {
        return this._origin;
    }

    /**
     * @returns {WT_FlightPlanDestination}
     */
    getDestination() {
        return this._destination;
    }

    /**
     * @returns {WT_FlightPlanSequence}
     */
    getEnroute() {
        return this._enroute;
    }

    /**
     * @returns {WT_FlightPlanDeparture}
     */
    getDeparture() {
        return this._departure;
    }

    /**
     * @returns {WT_FlightPlanArrival}
     */
    getArrival() {
        return this._arrival;
    }

    /**
     * @returns {WT_FlightPlanApproach}
     */
    getApproach() {
        return this._approach;
    }

    /**
     *
     * @param {Number} segment
     * @returns {WT_FlightPlanSegment}
     */
    getSegment(segment) {
        switch (segment) {
            case WT_FlightPlan.Segment.ORIGIN: return this._origin;
            case WT_FlightPlan.Segment.DEPARTURE: return this._departure;
            case WT_FlightPlan.Segment.ENROUTE: return this._enroute;
            case WT_FlightPlan.Segment.ARRIVAL: return this._arrival;
            case WT_FlightPlan.Segment.APPROACH: return this._approach;
            case WT_FlightPlan.Segment.DESTINATION: return this._destination;
            default: return null;
        }
    }

    /**
     * @returns {WT_NumberUnitReadOnly}
     */
    totalDistance() {
        return this._totalDistance.readonly();
    }

    _updateFromSegment(segment) {
        switch (segment) {
            case WT_FlightPlan.Segment.ORIGIN:
                if (this.hasDeparture()) {
                    this._departure._update();
                }
            case WT_FlightPlan.Segment.DEPARTURE:
                this._enroute._update();
            case WT_FlightPlan.Segment.ENROUTE:
                if (this.hasArrival()) {
                    this._arrival._update();
                }
            case WT_FlightPlan.Segment.ARRIVAL:
                if (this.hasApproach()) {
                    this._approach._update();
                }
            case WT_FlightPlan.Segment.APPROACH:
                if (this.hasDestination()) {
                    this._destination._update();
                }
        }
    }

    _updateLegs() {
        this._legs.splice(0, this._legs.length);
        if (this.hasOrigin()) {
            if (!this._departure || this._departure.runwayTransitionIndex < 0) {
                this._legs.push(...this._origin.legs);
            } else {
                this._origin.leg()._index = -1;
            }
            if (this._departure) {
                this._legs.push(...this._departure.legs);
            }
        }
        this._legs.push(...this._enroute.legs);
        if (this.hasDestination()) {
            if (this._arrival) {
                this._legs.push(...this._arrival.legs);
            }
            if (this._approach) {
                this._legs.push(...this._approach.legs);
            }
            if (!this._approach || !this._approach.procedure.runway) {
                this._legs.push(...this._destination.legs);
            } else {
                this._destination.leg()._index = -1;
            }
        }

        for (let i = 0; i < this._legs.length; i++) {
            this._legs[i]._index = i;
        }

        let lastLeg = this._legs[this._legs.length - 1];
        this._totalDistance.set(lastLeg ? lastLeg.cumulativeDistance : 0);
    }

    /**
     *
     * @param {WT_ReadOnlyArray<WT_FlightPlanLeg>} source
     * @param {WT_ReadOnlyArray<WT_FlightPlanLeg>} target
     */
    _changeAltitudeConstraints(source, target) {
        for (let i = 0; i < target.length; i++) {
            let sourceLegConstraint = source.get(i).altitudeConstraint;
            let targetLegConstraint = target.get(i).altitudeConstraint;
            if (!sourceLegConstraint.equals(targetLegConstraint)) {
                sourceLegConstraint.publishedConstraint ? targetLegConstraint.setPublishedConstraint(sourceLegConstraint.publishedConstraint) : targetLegConstraint.removePublishedConstraint();
                sourceLegConstraint.advisoryAltitude ? targetLegConstraint.setAdvisoryAltitude(sourceLegConstraint.advisoryAltitude) : targetLegConstraint.removeAdvisoryAltitude();
                sourceLegConstraint.customAltitude ? targetLegConstraint.setCustomAltitude(sourceLegConstraint.customAltitude) : targetLegConstraint.removeCustomAltitude();
            }
        }
    }

    /**
     *
     * @param {WT_Waypoint} origin
     * @param {*} eventData
     */
    _changeOrigin(origin, eventData) {
        if (origin === null && this._origin.waypoint === null) {
            return;
        } else if (origin !== null && this._origin.waypoint !== null && origin.uniqueID === this._origin.waypoint.uniqueID) {
            return;
        }

        eventData.types = eventData.types | WT_FlightPlanEvent.Type.ORIGIN_CHANGED;
        eventData.oldOrigin = this._origin.waypoint;
        eventData.newOrigin = origin;
        if (this._origin.waypoint) {
            this._origin.leg()._index = -1;
        }
        this._origin._setWaypoint(origin);
    }

    _changeDeparture(departure, eventData) {
        if (departure === null && this._departure === null) {
            return;
        } else if (departure !== null && departure.equals(this._departure)) {
            this._changeAltitudeConstraints(departure.legs, this._departure.legs);
            return;
        }

        eventData.types = eventData.types | WT_FlightPlanEvent.Type.DEPARTURE_CHANGED;
        eventData.oldDeparture = this._departure;
        eventData.newDeparture = departure;
        if (this._departure) {
            this._departure.legs.forEach(leg => leg._index = -1);
            this._departure._setFlightPlan(null);
        }
        this._departure = departure;
        if (departure) {
            this._departure._setFlightPlan(this);
        }
    }

    _changeArrival(arrival, eventData) {
        if (arrival === null && this._arrival === null) {
            return;
        } else if (arrival !== null && arrival.equals(this._arrival)) {
            this._changeAltitudeConstraints(arrival.legs, this._arrival.legs);
            return;
        }

        eventData.types = eventData.types | WT_FlightPlanEvent.Type.ARRIVAL_CHANGED;
        eventData.oldArrival = this._arrival;
        eventData.newArrival = arrival;
        if (this._arrival) {
            this._arrival.legs.forEach(leg => leg._index = -1);
            this._arrival._setFlightPlan(null);
        }
        this._arrival = arrival;
        if (arrival) {
            this._arrival._setFlightPlan(this);
        }
    }

    _changeApproach(approach, eventData) {
        if (approach === null && this._approach === null) {
            return;
        } else if (approach !== null && approach.equals(this._approach)) {
            this._changeAltitudeConstraints(approach.legs, this._approach.legs);
            return;
        }

        eventData.types = eventData.types | WT_FlightPlanEvent.Type.APPROACH_CHANGED;
        eventData.oldApproach = this._approach;
        eventData.newApproach = approach;
        if (this._approach) {
            this._approach.legs.forEach(leg => leg._index = -1);
            this._approach._setFlightPlan(null);
        }
        this._approach = approach;
        if (approach) {
            this._approach._setFlightPlan(this);
        }
    }

    _changeDestination(destination, eventData) {
        if (destination === null && this._destination.waypoint === null) {
            return;
        } else if (destination !== null && this._destination.waypoint !== null && destination.uniqueID === this._destination.waypoint.uniqueID) {
            return;
        }

        eventData.types = eventData.types | WT_FlightPlanEvent.Type.DESTINATION_CHANGED;
        eventData.oldDestination = this._destination.waypoint;
        eventData.newDestination = destination;
        if (this._destination.waypoint) {
            this._destination.leg()._index = -1;
        }
        this._destination._setWaypoint(destination);
    }

    /**
     *
     * @param {String} icao
     */
    async setOriginICAO(icao) {
        let waypoint = await this._icaoWaypointFactory.getWaypoint(icao);
        this.setOrigin(waypoint);
    }

    /**
     *
     * @param {WT_Waypoint} waypoint
     */
    setOrigin(waypoint) {
        if ((!waypoint && !this.hasOrigin()) || (waypoint && waypoint.equals(this.getOrigin().waypoint))) {
            return;
        }

        let eventData = {types: 0};
        this._changeOrigin(waypoint, eventData);
        this._changeDeparture(null, eventData);
        this._enroute._setPrevious(this._origin);
        this._updateFromSegment(this._enroute.segment);
        this._updateLegs();
        this._fireEvent(eventData);
    }

    removeOrigin() {
        if (!this.hasOrigin()) {
            return;
        }

        let eventData = {types: 0};
        this._changeOrigin(null, eventData);
        this._changeDeparture(null, eventData);
        this._enroute._setPrevious(this._origin);
        this._updateFromSegment(this._enroute.segment);
        this._updateLegs();
        this._fireEvent(eventData);
    }

    /**
     *
     * @param {String} icao
     */
    async setDestinationICAO(icao) {
        let waypoint = await this._icaoWaypointFactory.getWaypoint(icao);
        this.setDestination(waypoint);
    }

    /**
     *
     * @param {WT_Waypoint} waypoint
     */
    setDestination(waypoint) {
        if ((!waypoint && !this.hasDestination()) || (waypoint && waypoint.equals(this.getDestination().waypoint))) {
            return;
        }

        let eventData = {types: 0};
        this._changeDestination(waypoint, eventData);
        this._destination._setPrevious(this._enroute);
        this._changeArrival(null, eventData);
        this._changeApproach(null, eventData);
        this._updateLegs();
        this._fireEvent(eventData);
    }

    removeDestination() {
        if (!this.hasDestination()) {
            return;
        }

        let eventData = {types: 0};
        this._changeDestination(null, eventData);
        this._destination._setPrevious(this._enroute);
        this._changeArrival(null, eventData);
        this._changeApproach(null, eventData);
        this._updateLegs();
        this._fireEvent(eventData);
    }

    /**
     *
     * @param {WT_ReadOnlyArray<WT_ProcedureLeg>} procedureLegs
     * @param {WT_FlightPlanProcedureLeg[]} legs
     */
    async _buildLegsFromProcedure(procedureLegs, legs) {
        for (let i = 0; i < procedureLegs.length; i++) {
            let previous = legs[legs.length - 1];
            let previousEndpoint = previous ? previous.endpoint : null;
            let currentProcLeg = procedureLegs.get(i);
            if (currentProcLeg) {
                let nextProcLeg = procedureLegs.get(i + 1);
                try {
                    let leg = await this._procedureLegFactory.create(currentProcLeg, previousEndpoint, nextProcLeg);
                    if (leg && !(currentProcLeg.type === WT_ProcedureLeg.Type.INITIAL_FIX && leg.endpoint.equals(previousEndpoint))) {
                        legs.push(leg);
                    }
                } catch (e) {
                    console.log(e);
                }
            }
        }
    }

    /**
     *
     * @param {WT_Departure} departure
     * @param {Number} runwayTransitionIndex
     * @param {Number} enrouteTransitionIndex
     */
    async _setDeparture(departure, runwayTransitionIndex, enrouteTransitionIndex) {
        let runwayTransition = departure.runwayTransitions.getByIndex(runwayTransitionIndex);
        let enrouteTransition = departure.enrouteTransitions.getByIndex(enrouteTransitionIndex);

        let legs = [];
        if (runwayTransition) {
            await this._buildLegsFromProcedure(runwayTransition.legs, legs);
        }
        await this._buildLegsFromProcedure(departure.commonLegs, legs);
        if (enrouteTransition) {
            await this._buildLegsFromProcedure(enrouteTransition.legs, legs);
        }

        let eventData = {types: 0};
        this._changeDeparture(new WT_FlightPlanDeparture(departure, runwayTransitionIndex, enrouteTransitionIndex, legs), eventData);
        this._departure._setPrevious(this._origin);
        this._enroute._setPrevious(this._departure);
        this._updateFromSegment(this._enroute.segment);
        this._updateLegs();
        this._fireEvent(eventData);
    }

    /**
     *
     * @param {String} name
     * @param {Number} runwayTransitionIndex
     * @param {Number} enrouteTransitionIndex
     */
    async setDeparture(name, runwayTransitionIndex, enrouteTransitionIndex) {
        if (!this.isOriginAirport() ||
            (this.hasDeparture() && (this._departure.procedure.name === name && this._departure.runwayTransitionIndex === runwayTransitionIndex && this._departure.enrouteTransitionIndex === enrouteTransitionIndex))) {
            return;
        }

        let departure = this._origin.waypoint.departures.getByName(name);
        await this._setDeparture(departure, runwayTransitionIndex, enrouteTransitionIndex);
    }

    /**
     *
     * @param {Number} index
     * @param {Number} runwayTransitionIndex
     * @param {Number} enrouteTransitionIndex
     */
    async setDepartureIndex(index, runwayTransitionIndex, enrouteTransitionIndex) {
        if (!this.isOriginAirport() ||
            (this.hasDeparture() && (this._departure.procedure.name === this._origin.departures.getByIndex(index).name && this._departure.runwayTransitionIndex === runwayTransitionIndex && this._departure.enrouteTransitionIndex === enrouteTransitionIndex))) {
            return;
        }

        let departure = this._origin.waypoint.departures.getByIndex(index);
        await this._setDeparture(departure, runwayTransitionIndex, enrouteTransitionIndex);
    }

    removeDeparture() {
        if (!this.hasDeparture()) {
            return;
        }

        let eventData = {types: 0};
        this._changeDeparture(null, eventData);
        this._enroute._setPrevious(this._origin);
        this._updateLegs();
        this._fireEvent(eventData);
    }

    /**
     *
     * @param {WT_Arrival} arrival
     * @param {Number} enrouteTransitionIndex
     * @param {Number} runwayTransitionIndex
     */
    async _setArrival(arrival, enrouteTransitionIndex, runwayTransitionIndex) {
        let enrouteTransition = arrival.enrouteTransitions.getByIndex(enrouteTransitionIndex);
        let runwayTransition = arrival.runwayTransitions.getByIndex(runwayTransitionIndex);

        let legs = [];
        if (enrouteTransition) {
            await this._buildLegsFromProcedure(enrouteTransition.legs, legs);
        }
        await this._buildLegsFromProcedure(arrival.commonLegs, legs);
        if (runwayTransition) {
            await this._buildLegsFromProcedure(runwayTransition.legs, legs);
            // remove runway fix
            legs.pop();
        }

        let eventData = {types: 0};
        this._changeArrival(new WT_FlightPlanArrival(arrival, runwayTransitionIndex, enrouteTransitionIndex, legs), eventData);
        this._arrival._setPrevious(this._enroute);
        if (this.hasApproach()) {
            this._approach._setPrevious(this._arrival);
        }
        this._destination._setPrevious(this._arrival);
        this._updateLegs();
        this._fireEvent(eventData);
    }

    /**
     *
     * @param {String} name
     * @param {Number} enrouteTransitionIndex
     * @param {Number} [runwayTransitionIndex]
     */
    async setArrival(name, enrouteTransitionIndex, runwayTransitionIndex = -1) {
        if (!this.isDestinationAirport() ||
            (this.hasArrival() && (this._arrival.procedure.name === name && this._arrival.runwayTransitionIndex === runwayTransitionIndex && this._arrival.enrouteTransitionIndex === enrouteTransitionIndex))) {
            return;
        }

        let arrival = this._destination.waypoint.arrivals.getByName(name);
        await this._setArrival(arrival, enrouteTransitionIndex, runwayTransitionIndex);
    }

    /**
     *
     * @param {Index} index
     * @param {Number} runwayTransitionIndex
     * @param {Number} [enrouteTransitionIndex]
     */
    async setArrivalIndex(index, enrouteTransitionIndex, runwayTransitionIndex = -1) {
        if (!this.isDestinationAirport() ||
            (this.hasArrival() && (this._arrival.procedure.name === this._destination.arrivals.getByIndex(index).name && this._arrival.runwayTransitionIndex === runwayTransitionIndex && this._arrival.enrouteTransitionIndex === enrouteTransitionIndex))) {
            return;
        }

        let arrival = this._destination.waypoint.arrivals.getByIndex(index);
        await this._setArrival(arrival, enrouteTransitionIndex, runwayTransitionIndex);
    }

    removeArrival() {
        if (!this.hasArrival()) {
            return;
        }

        let eventData = {types: 0};
        this._changeArrival(null, eventData);
        if (this.hasApproach()) {
            this._approach._setPrevious(this._enroute);
        }
        this._destination._setPrevious(this._enroute);
        this._updateLegs();
        this._fireEvent(eventData);
    }

    /**
     *
     * @param {WT_Approach} approach
     * @param {Number} transitionIndex
     */
    async _setApproach(approach, transitionIndex) {
        let transition;
        if (transitionIndex >= 0) {
            transition = approach.transitions.getByIndex(transitionIndex);
        }
        let legs = [];
        if (transition) {
            await this._buildLegsFromProcedure(transition.legs, legs);
        }
        await this._buildLegsFromProcedure(approach.finalLegs, legs);
        let eventData = {types: 0};
        this._changeApproach(new WT_FlightPlanApproach(approach, transitionIndex, legs), eventData);
        if (this.hasArrival()) {
            this._approach._setPrevious(this._arrival);
            this._destination._setPrevious(this._arrival);
        } else {
            this._approach._setPrevious(this._enroute);
            this._destination._setPrevious(this._enroute);
        }
        this._updateLegs();
        this._fireEvent(eventData);
    }

    /**
     *
     * @param {String} name
     * @param {Number} [transitionIndex]
     */
    async setApproach(name, transitionIndex = -1) {
        if (!this.isDestinationAirport() ||
            (this.hasApproach() && (this._approach.procedure.name === name && this._approach.transitionIndex === transitionIndex))) {
            return;
        }

        let approach = this._destination.waypoint.approaches.getByName(name);
        await this._setApproach(approach, transitionIndex);
    }

    /**
     *
     * @param {Number} index
     * @param {Number} [transitionIndex]
     */
    async setApproachIndex(index, transitionIndex = -1) {
        if (!this.isDestinationAirport() ||
            (this.hasApproach() && (this._approach.procedure.name === this._destination.approaches.getByIndex(index).name && this._approach.transitionIndex === transitionIndex))) {
            return;
        }

        let approach = this._destination.waypoint.approaches.getByIndex(index);
        await this._setApproach(approach, transitionIndex);
    }

    removeApproach() {
        if (!this.hasApproach()) {
            return;
        }

        let eventData = {types: 0};
        this._changeApproach(null, eventData);
        if (this.hasArrival()) {
            this._destination._setPrevious(this._arrival);
        } else {
            this._destination._setPrevious(this._enroute);
        }
        this._updateLegs();
        this._fireEvent(eventData);
    }

    /**
     *
     * @param {WT_FlightPlanSegment} segmentElement
     * @param {WT_FlightPlanElement[]} elements
     * @param {Number} index
     * @param {Object} eventData
     */
    _insertToSegment(segmentElement, elements, index, eventData) {
        if (elements.length === 0) {
            return;
        }

        let eventType;
        switch (segmentElement.segment) {
            case WT_FlightPlan.Segment.DEPARTURE:
                eventType = WT_FlightPlanEvent.Type.DEPARTURE_ELEMENT_ADDED;
                break;
            case WT_FlightPlan.Segment.ENROUTE:
                eventType = WT_FlightPlanEvent.Type.ENROUTE_ELEMENT_ADDED;
                break;
            case WT_FlightPlan.Segment.ARRIVAL:
                eventType = WT_FlightPlanEvent.Type.ARRIVAL_ELEMENT_ADDED;
                break;
            case WT_FlightPlan.Segment.APPROACH:
                eventType = WT_FlightPlanEvent.Type.APPROACH_ELEMENT_ADDED;
                break;
        }
        eventData.types = eventData.types | eventType;

        if (!eventData.elementsAdded) {
            eventData.elementsAdded = [];
        }
        if (!eventData.elementsAdded[segmentElement.segment]) {
            eventData.elementsAdded[segmentElement.segment] = [];
        }
        for (let i = 0; i < elements.length; i++) {
            eventData.elementsAdded[segmentElement.segment].push({element: elements[i], index: index + i});
        }
        segmentElement._insertMultiple(elements, index);
    }

    /**
     *
     * @param {WT_FlightPlanSegment} segmentElement
     * @param {Number} index
     * @param {Number} count
     * @param {Object} eventData
     */
    _removeFromSegment(segmentElement, index, count, eventData) {
        if (index < 0 || index >= segmentElement.length || count === 0) {
            return;
        }

        let eventType;
        switch (segmentElement.segment) {
            case WT_FlightPlan.Segment.DEPARTURE:
                eventType = WT_FlightPlanEvent.Type.DEPARTURE_ELEMENT_REMOVED;
                break;
            case WT_FlightPlan.Segment.ENROUTE:
                eventType = WT_FlightPlanEvent.Type.ENROUTE_ELEMENT_REMOVED;
                break;
            case WT_FlightPlan.Segment.ARRIVAL:
                eventType = WT_FlightPlanEvent.Type.ARRIVAL_ELEMENT_REMOVED;
                break;
            case WT_FlightPlan.Segment.APPROACH:
                eventType = WT_FlightPlanEvent.Type.APPROACH_ELEMENT_REMOVED;
                break;
        }
        eventData.types = eventData.types | eventType;

        if (!eventData.elementsRemoved) {
            eventData.elementsRemoved = [];
        }
        if (!eventData.elementsRemoved[segmentElement.segment]) {
            eventData.elementsRemoved[segmentElement.segment] = [];
        }
        for (let i = index; i < index + count && i < segmentElement.length; i++) {
            let removed = segmentElement.elements.get(i);
            removed._index = -1;
            eventData.elementsRemoved[segmentElement.segment].push({element: removed, index: i});
        }
        segmentElement._removeByIndex(index, count);
    }

    _clearSegment(segmentElement, eventData) {
        this._removeFromSegment(segmentElement, 0, segmentElement.length, eventData);
    }

    /**
     *
     * @param {WT_FlightPlanSegment} segmentElement
     * @param {WT_FlightPlanElement[]} elements
     * @param {Object} eventData
     */
    _setSegmentTo(segmentElement, elements, eventData) {
        if (segmentElement.length === elements.length && segmentElement.elements.every((element, index) => element.equals(elements[index]))) {
            return;
        }

        this._clearSegment(segmentElement, eventData);
        this._insertToSegment(segmentElement, elements, 0, eventData);
    }

    /**
     *
     * @param {WT_FlightPlan.Segment} segment
     * @param {WT_FlightPlanWaypointEntry} waypointEntry
     * @param {Number} [index]
     * @returns {Promise<WT_FlightPlanLeg>}
     */
    async insertWaypoint(segment, waypointEntry, index) {
        let elements = await this.insertWaypoints(segment, [waypointEntry], index);
        return elements.length > 0 ? elements[0] : null;
    }

    /**
     *
     * @param {WT_Waypoint} fix
     * @param {WT_GeoPoint[]} points
     */
    _createLegSteps(fix, points) {
        let next = new WT_FlightPlanLegDirectStep(fix.location);
        for (let i = points.length - 1; i >= 0 ; i--) {
            let step = new WT_FlightPlanLegDirectStep(points[i]);
            step._setNext(next, false);
            next = step;
        }
        return next;
    }

    /**
     *
     * @param {WT_FlightPlan.Segment} segment
     * @param {WT_FlightPlanWaypointEntry[]} waypointEntries
     * @param {Number} index
     * @returns {Promise<WT_FlightPlanLeg[]>}
     */
    async insertWaypoints(segment, waypointEntries, index) {
        let elements;
        switch (segment) {
            case WT_FlightPlan.Segment.DEPARTURE:
            case WT_FlightPlan.Segment.ENROUTE:
            case WT_FlightPlan.Segment.ARRIVAL:
            case WT_FlightPlan.Segment.APPROACH:
                let segmentElement = this.getSegment(segment);
                if (index === undefined) {
                    index = segmentElement.length;
                }
                elements = await Promise.all(waypointEntries.map(async entry => {
                    let waypoint = entry.waypoint;
                    if (!waypoint) {
                        waypoint = await this._icaoWaypointFactory.getWaypoint(entry.icao);
                    }
                    if (entry.steps && entry.steps.length > 0) {
                        return new WT_FlightPlanWaypointFixLeg(waypoint, this._createLegSteps(waypoint, entry.steps), entry.isAltitudeSuppressed, entry.publishedConstraint, entry.advisoryAltitude, entry.customAltitude);
                    } else {
                        return new WT_FlightPlanDirectToWaypointLeg(waypoint, entry.isAltitudeSuppressed, entry.publishedConstraint, entry.advisoryAltitude, entry.customAltitude);
                    }
                }, this));
                let eventData = {types: 0};
                this._insertToSegment(segmentElement, elements, index, eventData);
                this._updateFromSegment(segment);
                this._updateLegs();
                this._fireEvent(eventData);
        }
        return elements ? elements : [];
    }

    /**
     *
     * @param {WT_FlightPlan.Segment} segment
     * @param {WT_Airway|String} airway
     * @param {WT_Waypoint|String} enter
     * @param {WT_Waypoint|String} exit
     * @param {Number} [index]
     * @returns {Promise<WT_FlightPlanAirwaySequence>}
     */
    async insertAirway(segment, airway, enter, exit, index) {
        let element = null;
        switch (segment) {
            case WT_FlightPlan.Segment.DEPARTURE:
            case WT_FlightPlan.Segment.ENROUTE:
            case WT_FlightPlan.Segment.ARRIVAL:
            case WT_FlightPlan.Segment.APPROACH:
                let segmentElement = this.getSegment(segment);
                if (index === undefined) {
                    index = segmentElement.length;
                }

                if (typeof airway === "string" && typeof enter === "string") {
                    enter = await this._icaoWaypointFactory.getWaypoint(enter);
                    let name = airway;
                    airway = enter.airways.find(airway => airway.name === name);
                    if (!airway) {
                        throw new Error(`Could not find entry waypoint ${enter.ident} in airway ${name}.`);
                    }
                }

                let waypoints = await airway.getWaypoints();
                let enterIndex = waypoints.findIndex(typeof enter === "string" ? (waypoint => waypoint.icao === enter) : (waypoint => waypoint.equals(enter)));
                let exitIndex = waypoints.findIndex(typeof exit === "string" ? (waypoint => waypoint.icao === exit) : (waypoint => waypoint.equals(exit)));
                if (enterIndex < 0 || exitIndex < 0) {
                    throw new Error("Invalid enter and/or exit points.");
                }

                let min = Math.min(enterIndex, exitIndex);
                let max = Math.max(enterIndex, exitIndex);
                let waypointSequence = waypoints.slice(min, max + 1);
                if (exitIndex < enterIndex) {
                    waypointSequence.reverse();
                }

                element = new WT_FlightPlanAirwaySequence(airway, waypointSequence.map(waypoint => new WT_FlightPlanDirectToWaypointLeg(waypoint)));

                let eventData = {types: 0};
                this._insertToSegment(segmentElement, [element], index, eventData);
                this._updateFromSegment(segment);
                this._updateLegs();
                this._fireEvent(eventData);
        }
        return element;
    }

    /**
     *
     * @param {WT_FlightPlan.Segment} segment
     * @param {WT_FlightPlanElement} element
     */
    removeElement(segment, element) {
        let segmentElement = this.getSegment(segment);
        let index = segmentElement.elements.indexOf(element);
        if (index >= 0) {
            this.removeByIndex(segment, index);
        }
    }

    /**
     *
     * @param {WT_FlightPlan.Segment} segment
     * @param {Number} index
     * @param {Number} [count]
     */
    removeByIndex(segment, index, count = 1) {
        switch (segment) {
            case WT_FlightPlan.Segment.DEPARTURE:
            case WT_FlightPlan.Segment.ENROUTE:
            case WT_FlightPlan.Segment.ARRIVAL:
            case WT_FlightPlan.Segment.APPROACH:
                let segmentElement = this.getSegment(segment);
                if (index >= 0 && index < segmentElement.length) {
                    let eventData = {types: 0};
                    this._removeFromSegment(segmentElement, index, count, eventData);
                    this._updateFromSegment(segment);
                    this._updateLegs();
                    this._fireEvent(eventData);
                }
        }
    }

    clear() {
        let eventData = {types: 0};
        this._changeOrigin(null, eventData);
        this._changeDestination(null, eventData);
        this._changeDeparture(null, eventData);
        this._clearSegment(this._enroute, eventData);
        this._changeArrival(null, eventData);
        this._changeApproach(null, eventData);
        this._enroute._setPrevious(this._origin);
        this._destination._setPrevious(this._enroute);
        this._updateLegs();
        this._fireEvent(eventData);
    }

    copy() {
        let copy = new WT_FlightPlan(this._icaoWaypointFactory);
        copy.copyFrom(flightPlan);
        return copy;
    }

    /**
     *
     * @param {WT_FlightPlan} flightPlan
     */
    copyFrom(flightPlan) {
        let eventData = {types: 0};
        this._changeOrigin(flightPlan.getOrigin().waypoint, eventData);
        this._changeDestination(flightPlan.getDestination().waypoint, eventData);
        if (flightPlan.hasDeparture()) {
            let departure = flightPlan.getDeparture();
            this._changeDeparture(departure.copy(), eventData);
            this._departure._setPrevious(this._origin);
        } else {
            this._changeDeparture(null, eventData);
        }
        this._enroute._setPrevious(this._departure ? this._departure : this._origin);
        if (!flightPlan.getEnroute().equals(this._enroute)) {
            let enrouteElements = flightPlan.getEnroute().elements.map(element => element.copy());
            this._clearSegment(this._enroute, eventData);
            this._insertToSegment(this._enroute, enrouteElements, 0, eventData);
        } else {
            this._changeAltitudeConstraints(flightPlan.getEnroute().legs, this._enroute.legs);
        }
        if (flightPlan.hasArrival()) {
            let arrival = flightPlan.getArrival();
            this._changeArrival(arrival.copy(), eventData);
            this._arrival._setPrevious(this._enroute);
        } else {
            this._changeArrival(null, eventData);
        }
        if (flightPlan.hasApproach()) {
            let approach = flightPlan.getApproach();
            this._changeApproach(approach.copy(), eventData);
            this._approach._setPrevious(this._arrival ? this._arrival : this._enroute);
        } else {
            this._changeApproach(null, eventData);
        }
        if (this.hasDestination()) {
            this._destination._setPrevious(this._arrival ? this._arrival : this._enroute);
        }
        if (eventData.types !== 0) {
            this._updateLegs();
            this._fireEvent(eventData);
        }
    }

    /**
     *
     * @param {WT_FlightPlan} flightPlan
     * @param {WT_FlightPlan.Segment} segment
     */
    copySegmentFrom(flightPlan, segment) {
        let eventData = {types: 0};
        switch (segment) {
            case WT_FlightPlan.Segment.ORIGIN:
                this._changeOrigin(flightPlan.getOrigin().waypoint, eventData);
                break;
            case WT_FlightPlan.Segment.DEPARTURE:
                if (flightPlan.hasDeparture()) {
                    let departure = flightPlan.getDeparture();
                    this._changeDeparture(departure.copy(), eventData);
                    this._departure._setPrevious(this._origin);
                } else {
                    this._changeDeparture(null, eventData);
                }
                break;
            case WT_FlightPlan.Segment.ENROUTE:
                if (!flightPlan.getEnroute().equals(this._enroute)) {
                    let enrouteElements = flightPlan.getEnroute().elements.map(element => element.copy());
                    this._clearSegment(this._enroute, eventData);
                    this._insertToSegment(this._enroute, enrouteElements, 0, eventData);
                } else {
                    this._changeAltitudeConstraints(flightPlan.getEnroute().legs, this._enroute.legs);
                }
                break;
            case WT_FlightPlan.Segment.ARRIVAL:
                if (flightPlan.hasArrival()) {
                    let arrival = flightPlan.getArrival();
                    this._changeArrival(arrival.copy(), eventData);
                    this._arrival._setPrevious(this._enroute);
                } else {
                    this._changeArrival(null, eventData);
                }
                if (this.hasDestination()) {
                    this._destination._setPrevious(this._arrival ? this._arrival : this._enroute);
                }
                break;
            case WT_FlightPlan.Segment.APPROACH:
                if (flightPlan.hasApproach()) {
                    let approach = flightPlan.getApproach();
                    this._changeApproach(approach.copy(), eventData);
                    this._approach._setPrevious(this._arrival ? this._arrival : this._enroute);
                } else {
                    this._changeApproach(null, eventData);
                }
                break;
        }
        if (eventData.types !== 0) {
            this._updateLegs();
            this._fireEvent(eventData);
        }
    }

    /**
     *
     * @param {WT_FlightPlanLegAltitudeConstraint} constraint
     * @param {*} data
     */
    _onLegAltitudeConstraintChanged(constraint, data) {
        let eventData = {
            types: WT_FlightPlanEvent.Type.LEG_ALTITUDE_CHANGED,
            changedConstraint: constraint
        };
        Object.assign(eventData, data);
        this._fireEvent(eventData);
    }

    _fireEvent(eventData) {
        if (eventData.types === 0) {
            return;
        }

        let event = new WT_FlightPlanEvent(this, eventData);
        this._listeners.forEach(listener => listener(event));
    }

    addListener(listener) {
        this._listeners.push(listener);
    }

    removeListener(listener) {
        let index = this._listeners.indexOf(listener);
        if (index >= 0) {
            this._listeners.splice(index, 1);
        }
    }

    clearListeners() {
        this._listeners = [];
    }
}
/**
 * @enum {Number}
 */
WT_FlightPlan.Segment = {
    ORIGIN: 0,
    DEPARTURE: 1,
    ENROUTE: 2,
    ARRIVAL: 3,
    APPROACH: 4,
    DESTINATION: 5
};

/**
 * @typedef {Object} WT_FlightPlanWaypointEntry
 * @property {String} [icao]
 * @property {WT_Waypoint} [waypoint]
 * @property {WT_GeoPoint[]} [steps]
 * @property {WT_NumberUnit} [advisoryAltitude]
 * @property {WT_AltitudeConstraint} [publishedConstraint]
 * @property {Boolean} [flyOver]
 */

class WT_FlightPlanEvent {
    constructor(source, data) {
        this._source = source;
        this._data = data;
    }

    /**
     * @readonly
     * @type {WT_FlightPlan}
     */
    get source() {
        return this._source;
    }

    /**
     * @readonly
     * @property {Number} types
     * @type {Number}
     */
    get types() {
        return this._data.types;
    }

    anyType(type) {
        return (this.types & type) !== 0;
    }

    allTypes(type) {
        return (this.types & type) === type;
    }

    get oldOrigin() {
        return this._data.oldOrigin;
    }

    get newOrigin() {
        return this._data.newOrigin;
    }

    get oldDeparture() {
        return this._data.oldDeparture;
    }

    get newDeparture() {
        return this._data.newDeparture;
    }

    get oldDestination() {
        return this._data.oldDestination;
    }

    get newDestination() {
        return this._data.newDestination;
    }

    get oldArrival() {
        return this._data.oldArrival;
    }

    get newArrival() {
        return this._data.newArrival;
    }

    get oldApproach() {
        return this._data.oldApproach;
    }

    get newApproach() {
        return this._data.newApproach;
    }

    get elementsAdded() {
        return this._data.elementsAdded;
    }

    get elementsRemoved() {
        return this._data.elementsRemoved;
    }

    get changedConstraint() {
        return this._data.changedConstraint;
    }

    get oldIsSuppressed() {
        return this._data.oldIsSuppressed;
    }

    get oldPublishedConstraint() {
        return this._data.oldPublishedConstraint;
    }

    get oldAdvisoryAltitude() {
        return this._data.oldAdvisoryAltitude;
    }

    get oldCustomAltitude() {
        return this._data.oldCustomAltitude;
    }
}
/**
 * @enum {Number}
 */
WT_FlightPlanEvent.Type = {
    ORIGIN_CHANGED: 1,
    DESTINATION_CHANGED: 1 << 2,
    DEPARTURE_CHANGED: 1 << 3,
    ARRIVAL_CHANGED: 1 << 4,
    APPROACH_CHANGED: 1 << 5,
    DEPARTURE_ELEMENT_ADDED: 1 << 6,
    DEPARTURE_ELEMENT_REMOVED: 1 << 7,
    ENROUTE_ELEMENT_ADDED: 1 << 8,
    ENROUTE_ELEMENT_REMOVED: 1 << 9,
    ARRIVAL_ELEMENT_ADDED: 1 << 10,
    ARRIVAL_ELEMENT_REMOVED: 1 << 11,
    APPROACH_ELEMENT_ADDED: 1 << 12,
    APPROACH_ELEMENT_REMOVED: 1 << 13,
    LEG_ALTITUDE_CHANGED: 1 << 14
};

class WT_FlightPlanElement {
    /**
     * @param {WT_FlightPlanElement} [parent]
     * @param {WT_FlightPlan.Segment} [segment]
     */
    constructor(parent, segment) {
        this._parent = null;
        this._flightPlan = null;
        this._segment = (typeof segment === "number") ? segment : null;
        this._setParent(parent);
        /**
         * @type {WT_FlightPlanElement}
         */
        this._prev;
        this._distance = new WT_NumberUnit(0, WT_Unit.GA_RADIAN);
        this._cumulativeDistance = new WT_NumberUnit(0, WT_Unit.GA_RADIAN);
        /**
         * @type {WT_FlightPlanLeg[]}
         */
        this._legs = [];
        this._legsReadOnly = new WT_ReadOnlyArray(this._legs);
    }

    /**
     * @readonly
     * @property {WT_FlightPlanElement} parent
     * @type {WT_FlightPlanElement}
     */
    get parent() {
        return this._parent;
    }

    /**
     * @readonly
     * @property {WT_FlightPlan} flightPlan
     * @type {WT_FlightPlan}
     */
    get flightPlan() {
        return this.parent ? this.parent.flightPlan : this._flightPlan;
    }

    /**
     * @readonly
     * @property {Number} segment
     * @type {Number}
     */
    get segment() {
        if (this.parent) {
            return this.parent.segment;
        } else {
            return this._segment;
        }
    }

    /**
     * @readonly
     * @property {WT_GeoPointReadOnly} endpoint
     * @type {WT_GeoPointReadOnly}
     */
    get endpoint() {
        return undefined;
    }

    /**
     * @readonly
     * @property {WT_NumberUnitReadOnly} distance
     * @type {WT_NumberUnitReadOnly}
     */
    get distance() {
        return this._distance.readonly();
    }

    /**
     * @readonly
     * @property {WT_NumberUnitReadOnly} distance
     * @type {WT_NumberUnitReadOnly}
     */
    get cumulativeDistance() {
        return this._cumulativeDistance.readonly();
    }

    /**
     * @readonly
     * @type {WT_ReadOnlyArray<WT_FlightPlanLeg>}
     */
    get legs() {
        return this._legsReadOnly;
    }

    _updateDistance() {
    }

    _updateCumulativeDistance() {
        this._cumulativeDistance.set(this.distance.asUnit(WT_Unit.GA_RADIAN) + (this._prev ? this._prev.cumulativeDistance.asUnit(WT_Unit.GA_RADIAN) : 0));
    }

    _update() {
        this._updateDistance();
        this._updateCumulativeDistance();
    }

    /**
     *
     * @param {WT_FlightPlanElement} parent
     */
    _setParent(parent) {
        this._parent = parent;
        if (parent) {
            this._root = parent.root ? parent.root : parent;
        } else {
            this._root = null;
        }
    }

    /**
     *
     * @param {WT_FlightPlanElement} leg
     */
    _setPrevious(leg) {
        this._prev = leg;
        this._update();
    }

    copy() {
        return null;
    }
}

class WT_FlightPlanLeg extends WT_FlightPlanElement {
    /**
     * @param {WT_FlightPlanLegStep} firstStep
     * @param {Boolean} isAltitudeSuppressed
     * @param {WT_AltitudeConstraint} [publishedConstraint]
     * @param {WT_NumberUnit} [advisoryAltitude]
     * @param {WT_NumberUnit} [customAltitude]
     * @param {WT_FlightPlanElement} [parent]
     * @param {WT_FlightPlan.Segment} [segment]
     */
    constructor(firstStep, isAltitudeSuppressed, publishedConstraint, advisoryAltitude, customAltitude, parent, segment) {
        super(parent, segment);

        /**
         * @type {WT_FlightPlanLegStep}
         */
        this._firstStep = firstStep;
        this._firstStep._setLeg(this);
        this._stepCount = 1;
        this._altitudeConstraint = new WT_FlightPlanLegAltitudeConstraint(this, isAltitudeSuppressed, publishedConstraint, advisoryAltitude, customAltitude);
        this._desiredTrack = new WT_NavAngleUnit(false).createNumber(NaN);
        this._index = -1;

        this._legs.push(this);
    }

    /**
     * @readonly
     * @type {WT_GeoPointReadOnly}
     */
    get endpoint() {
        return this.fix.location;
    }

    /**
     * The index of this leg in its parent flight plan, or -1 if this leg does not belong to a flight plan.
     * @readonly
     * @type {Number}
     */
    get index() {
        return this._index;
    }

    /**
     * @readonly
     * @type {WT_Waypoint}
     */
    get fix() {
        return null;
    }

    /**
     * @readonly
     * @type {WT_NumberUnitReadOnly}
     */
    get desiredTrack() {
        return this._desiredTrack.readonly();
    }

    /**
     * @readonly
     * @type {Boolean}
     */
    get discontinuity() {
        return false;
    }

    /**
     * @readonly
     * @type {WT_FlightPlanLegAltitudeConstraint}
     */
    get altitudeConstraint() {
        return this._altitudeConstraint;
    }

    _updateSteps() {
        this._stepCount = 0;
        let currentStep = this.firstStep();
        let prevStep = null;
        while (currentStep) {
            currentStep.update(prevStep ? prevStep.endpoint : (this._prev ? this._prev.endpoint : null));
            if (currentStep.isLoop) {
                break;
            }
            prevStep = currentStep;
            currentStep = currentStep.next();
            this._stepCount++;
        }
    }

    _updateDistance() {
        this._distance.set(0);
        let currentStep = this.firstStep();
        while (currentStep) {
            this._distance.add(currentStep.distance);
            if (currentStep.isLoop) {
                break;
            }
            currentStep = currentStep.next();
        }
    }

    _updateDTK() {
        if (this._prev && this._prev.endpoint && this._stepCount === 1) {
            this._desiredTrack.unit.setLocation(this._prev.endpoint);
            this._desiredTrack.set(this._prev.endpoint.bearingTo(this.endpoint));
        } else {
            this._desiredTrack.set(NaN);
        }
    }

    _update() {
        this._updateSteps();
        super._update();
        this._updateDTK();
    }

    previousLeg() {
        if (this.flightPlan && this.index > 0) {
            return this.flightPlan.legs.get(this.index - 1);
        } else {
            return null;
        }
    }

    /**
     *
     * @returns {WT_FlightPlanLegStep}
     */
    firstStep() {
        return this._firstStep;
    }

    /**
     *
     * @param {WT_NumberUnitObject} distanceAlong
     * @param {WT_GeoPoint} [reference]
     * @returns {WT_GeoPoint}
     */
    getPointAlong(distanceAlong, reference) {
        if (!this._prev || !this._prev.endpoint) {
            return undefined;
        }

        let start = this._prev.endpoint;
        let step = this.firstStep();
        let stepDistanceGARad = step.distance.asUnit(WT_Unit.GA_RADIAN);
        let distanceAlongGARad = distanceAlong.asUnit(WT_Unit.GA_RADIAN);
        while (distanceAlongGARad > stepDistanceGARad) {
            if (step.isLoop || !step.next()) {
                break;
            }
            start = step.endpoint;
            step = step.next();
            distanceAlongGARad -= stepDistanceGARad;
        }

        // not completely accurate, but for now we will treat every step as a direct step
        return (reference ? reference.set(start) : new WT_GeoPoint(start.lat, start.long)).offset(start.bearingTo(step.endpoint), distanceAlongGARad, true);
    }

    equals(other) {
        return (other instanceof WT_FlightPlanLeg) && this.firstStep().equals(other.firstStep());
    }
}

class WT_FlightPlanLegAltitudeConstraint {
    /**
     * @param {WT_FlightPlanLeg} leg
     * @param {Boolean} [isSuppressed]
     * @param {WT_AltitudeConstraint} [publishedConstraint]
     * @param {WT_NumberUnit} [advisoryAltitude]
     * @param {WT_NumberUnit} [customAltitude]
     */
    constructor(leg, isSuppressed, publishedConstraint, advisoryAltitude, customAltitude) {
        this._leg = leg;
        this._isSuppressed = Boolean(isSuppressed);
        this._publishedConstraint = publishedConstraint ? publishedConstraint : null;
        this._advisoryAltitude = WT_Unit.FOOT.createNumber(advisoryAltitude ? advisoryAltitude.asUnit(WT_Unit.FOOT) : NaN);
        this._customAltitude = WT_Unit.FOOT.createNumber(customAltitude ? customAltitude.asUnit(WT_Unit.FOOT) : NaN)
    }

    /**
     * @readonly
     * @type {WT_FlightPlanLeg}
     */
    get leg() {
        return this._leg;
    }

    /**
     * @readonly
     * @type {Boolean}
     */
    get isSuppressed() {
        return this._isSuppressed;
    }

    /**
     * @readonly
     * @type {WT_AltitudeConstraint}
     */
    get publishedConstraint() {
        return this._publishedConstraint;
    }

    /**
     * @readonly
     * @type {WT_NumberUnitReadOnly}
     */
    get advisoryAltitude() {
        return this._advisoryAltitude.isNaN() ? null : this._advisoryAltitude.readonly();
    }

    /**
     * @readonly
     * @type {WT_NumberUnitReadOnly}
     */
    get customAltitude() {
        return this._customAltitude.isNaN() ? null : this._customAltitude.readonly();
    }

    setSuppressed(value) {
        if (this._isSuppressed === value) {
            return;
        }

        this._isSuppressed = value;
        if (this.leg.flightPlan) {
            this.leg.flightPlan._onLegAltitudeConstraintChanged(this, {oldIsSuppressed: !value});
        }
    }

    /**
     *
     * @param {WT_AltitudeConstraint} constraint
     */
    setPublishedConstraint(constraint) {
        if (!constraint || (!this._publishedConstraint && !constraint) || (constraint && constraint.equals(this._publishedConstraint))) {
            return;
        }

        let old = this._publishedConstraint;
        this._publishedConstraint = constraint;
        if (this.leg.flightPlan) {
            this.leg.flightPlan._onLegAltitudeConstraintChanged(this, {oldPublishedConstraint: old});
        }
    }

    removePublishedConstraint() {
        if (!this._publishedConstraint) {
            return;
        }

        let old = this._publishedConstraint;
        this._publishedConstraint = null;
        if (this.leg.flightPlan) {
            this.leg.flightPlan._onLegAltitudeConstraintChanged(this, {oldPublishedConstraint: old});
        }
    }

    /**
     *
     * @param {WT_NumberUnit} altitude
     */
    setAdvisoryAltitude(altitude) {
        if (!altitude || this._advisoryAltitude.equals(altitude)) {
            return;
        }

        let old = this.advisoryAltitude ? this.advisoryAltitude.copy() : null;
        this._advisoryAltitude.set(altitude);
        if (this.leg.flightPlan) {
            this.leg.flightPlan._onLegAltitudeConstraintChanged(this, {oldAdvisoryAltitude: old});
        }
    }

    removeAdvisoryAltitude() {
        if (this._advisoryAltitude.isNaN()) {
            return;
        }

        let old = this.advisoryAltitude.copy();
        this._advisoryAltitude.set(NaN);
        if (this.leg.flightPlan) {
            this.leg.flightPlan._onLegAltitudeConstraintChanged(this, {oldAdvisoryAltitude: old});
        }
    }

    /**
     *
     * @param {WT_NumberUnit} altitude
     */
    setCustomAltitude(altitude) {
        if (!altitude || this._customAltitude.equals(altitude) || this._advisoryAltitude.equals(altitude)) {
            return;
        }

        let old = this.customAltitude ? this.customAltitude.copy() : null;
        this._customAltitude.set(altitude);
        if (this.leg.flightPlan) {
            this.leg.flightPlan._onLegAltitudeConstraintChanged(this, {oldCustomAltitude: old});
        }
    }

    removeCustomAltitude() {
        if (this._customAltitude.isNaN()) {
            return;
        }

        let old = this.customAltitude.copy();
        this._customAltitude.set(NaN);
        if (this.leg.flightPlan) {
            this.leg.flightPlan._onLegAltitudeConstraintChanged(this, {oldCustomAltitude: old});
        }
    }

    /**
     *
     * @param {*} other
     * @returns {Boolean}
     */
    equals(other) {
        return other instanceof WT_FlightPlanLegAltitudeConstraint &&
               (!this.publishedConstraint && !other.publishedConstraint || (this.publishedConstraint && this.publishedConstraint.equals(other.publishedConstraint))) &&
               (!this.advisoryAltitude && !other.advisoryAltitude || (this.advisoryAltitude && this.advisoryAltitude.equals(other.advisoryAltitude))) &&
               (!this.customAltitude && !other.customAltitude || (this.customAltitude && this.customAltitude.equals(other.customAltitude)))
    }

    /**
     *
     * @param {WT_FlightPlanLegAltitudeConstraint} other
     */
    copyFrom(other) {
        if (other.publishedConstraint) {
            this.setPublishedConstraint(other.publishedConstraint);
        } else {
            this.removePublishedConstraint();
        }
        if (other.advisoryAltitude) {
            this.setAdvisoryAltitude(other.advisoryAltitude);
        } else {
            this.removeAdvisoryAltitude();
        }
        if (other.customAltitude) {
            this.setCustomAltitude(other.customAltitude);
        } else {
            this.removeCustomAltitude();
        }
    }
}

class WT_FlightPlanLegStep {
    constructor(type) {
        this._leg = null;
        this._type = type;
        this._next = null;
        this._isLoop = false;

        this._distance = new WT_NumberUnit(0, WT_Unit.GA_RADIAN);
    }

    /**
     * @readonly
     * @property {WT_FlightPlanLeg} leg - the flight plan leg of which this step is a part.
     * @type {WT_FlightPlanLeg}
     */
    get leg() {
        return this._leg;
    }

    /**
     * @readonly
     * @property {WT_FlightPlanLegStep.Type} type - the type of this leg step.
     * @type {WT_FlightPlanLegStep.Type}
     */
    get type() {
        return this._type;
    }

    /**
     * @readonly
     * @property {Boolean} isLoop - whether this leg step loops back to itself or a previous leg step.
     * @type {Boolean}
     */
    get isLoop() {
        return this._isLoop;
    }

    /**
     * @readonly
     * @property {WT_GeoPointReadOnly} endpoint
     * @type {WT_GeoPointReadOnly}
     */
    get endpoint() {
        return undefined;
    }

    /**
     * @readonly
     * @property {WT_NumberUnitReadOnly} distance
     * @type {WT_NumberUnitReadOnly}
     */
    get distance() {
        return this._distance.readonly();
    }

    /**
     *
     * @returns {WT_FlightPlanLegStep}
     */
    next() {
        return this._next;
    }

    /**
     *
     * @param {WT_FlightPlanLeg} leg
     */
    _setLeg(leg) {
        this._leg = leg;
        if (this.next()) {
            this.next()._setLeg(leg);
        }
    }

    /**
     *
     * @param {WT_FlightPlanLegStep} step
     * @param {Boolean} isLoop
     */
    _setNext(step, isLoop) {
        this._next = step;
        this._isLoop = isLoop;
    }

    /**
     *
     * @param {WT_GeoPoint} prevEndpoint
     */
    update(prevEndpoint) {
    }

    equals(other) {
        return (other instanceof WT_FlightPlanLegStep) && this.type === other.type && (this.next() ? this.next().equals(other.next()) : !other.next());
    }

    _copySelf() {
    }

    copy() {
        let copy = this._copySelf();
        let next = this.next();
        copy._setNext(next ? (this.isLoop ? next : next.copy()) : null, this.isLoop);
        return copy;
    }
}
/**
 * @enum {Number}
 */
WT_FlightPlanLegStep.Type = {
    INITIAL: 0,
    DIRECT: 1,
    HEADING: 2,
    TURN: 3
};

class WT_FlightPlanLegSimpleStep extends WT_FlightPlanLegStep {
    constructor(endpoint, type) {
        super(type);

        this._endpoint = new WT_GeoPoint(endpoint.lat, endpoint.long);
    }

    /**
     * @readonly
     * @property {WT_GeoPointReadOnly} endpoint
     * @type {WT_GeoPointReadOnly}
     */
    get endpoint() {
        return this._endpoint.readonly();
    }

    /**
     *
     * @param {WT_GeoPoint} prevEndpoint
     */
    update(prevEndpoint) {
        this._distance.set(prevEndpoint ? prevEndpoint.distance(this.endpoint) : 0);
    }

    equals(other) {
        return super.equals(other) && this.endpoint.equals(other.endpoint);
    }
}

class WT_FlightPlanLegInitialStep extends WT_FlightPlanLegSimpleStep {
    constructor(location) {
        super(location, WT_FlightPlanLegStep.Type.INITIAL);
    }

    _copySelf() {
        return new WT_FlightPlanLegInitialStep(this.endpoint);
    }
}

class WT_FlightPlanLegDirectStep extends WT_FlightPlanLegSimpleStep {
    constructor(endpoint) {
        super(endpoint, WT_FlightPlanLegStep.Type.DIRECT);
    }

    _copySelf() {
        return new WT_FlightPlanLegDirectStep(this.endpoint);
    }
}

class WT_FlightPlanLegHeadingStep extends WT_FlightPlanLegSimpleStep {
    constructor(endpoint) {
        super(endpoint, WT_FlightPlanLegStep.Type.HEADING);
    }

    /**
     *
     * @param {WT_GeoPoint} prevEndpoint
     */
    update(prevEndpoint) {
        this._distance.set(prevEndpoint ? prevEndpoint.distanceRhumb(this.endpoint) : 0);
    }

    _copySelf() {
        return new WT_FlightPlanLegHeadingStep(this.endpoint);
    }
}

class WT_FlightPlanWaypointFixLeg extends WT_FlightPlanLeg {
    /**
     *
     * @param {WT_Waypoint} fix
     * @param {WT_FlightPlanLeg} firstStep
     * @param {Boolean} isAltitudeSuppressed
     * @param {WT_AltitudeConstraint} [publishedConstraint]
     * @param {WT_NumberUnit} [advisoryAltitude]
     * @param {WT_NumberUnit} [customAltitude]
     * @param {WT_FlightPlanElement} [parent]
     * @param {WT_FlightPlan.Segment} [segment]
     */
    constructor(fix, firstStep, isAltitudeSuppressed, publishedConstraint, advisoryAltitude, customAltitude, parent, segment) {
        super(firstStep, isAltitudeSuppressed, publishedConstraint, advisoryAltitude, customAltitude, parent, segment);
        this._fix = fix;
    }

    /**
     * @readonly
     * @property {WT_Waypoint} fix
     * @type {WT_Waypoint}
     */
    get fix() {
        return this._fix;
    }

    copy() {
        return new WT_FlightPlanWaypointFixLeg(this.fix, this.firstStep().copy(), this.altitudeConstraint.isSuppressed, this.altitudeConstraint.publishedConstraint, this.altitudeConstraint.advisoryAltitude, this.altitudeConstraint.customAltitude, null, this._segment);
    }
}

class WT_FlightPlanInitialWaypointLeg extends WT_FlightPlanWaypointFixLeg {
    /**
     *
     * @param {WT_Waypoint} fix
     * @param {Boolean} isAltitudeSuppressed
     * @param {WT_AltitudeConstraint} [publishedConstraint]
     * @param {WT_NumberUnit} [advisoryAltitude]
     * @param {WT_NumberUnit} [customAltitude]
     * @param {WT_FlightPlanElement} [parent]
     * @param {WT_FlightPlan.Segment} [segment]
     */
    constructor(fix, isAltitudeSuppressed, publishedConstraint, advisoryAltitude, customAltitude, parent, segment) {
        super(fix, new WT_FlightPlanLegInitialStep(fix.location), isAltitudeSuppressed, publishedConstraint, advisoryAltitude, customAltitude, parent, segment);
    }

    copy() {
        return new WT_FlightPlanInitialWaypointLeg(this.fix, this.altitudeConstraint.isSuppressed, this.altitudeConstraint.publishedConstraint, this.altitudeConstraint.advisoryAltitude, this.altitudeConstraint.customAltitude, null, this._segment);
    }

    equals(other) {
        return (other instanceof WT_FlightPlanInitialWaypointLeg) && this.fix.uniqueID === other.fix.uniqueID;
    }
}

class WT_FlightPlanDirectToWaypointLeg extends WT_FlightPlanWaypointFixLeg {
    /**
     *
     * @param {WT_Waypoint} fix
     * @param {Boolean} isAltitudeSuppressed
     * @param {WT_AltitudeConstraint} [publishedConstraint]
     * @param {WT_NumberUnit} [advisoryAltitude]
     * @param {WT_NumberUnit} [customAltitude]
     * @param {WT_FlightPlanElement} [parent]
     * @param {WT_FlightPlan.Segment} [segment]
     */
    constructor(fix, isAltitudeSuppressed, publishedConstraint, advisoryAltitude, customAltitude, parent, segment) {
        super(fix, new WT_FlightPlanLegDirectStep(fix.location), isAltitudeSuppressed, publishedConstraint, advisoryAltitude, customAltitude, parent, segment);
    }

    copy() {
        return new WT_FlightPlanDirectToWaypointLeg(this.fix, this.altitudeConstraint.isSuppressed, this.altitudeConstraint.publishedConstraint, this.altitudeConstraint.advisoryAltitude, this.altitudeConstraint.customAltitude, null, this._segment);
    }

    equals(other) {
        return (other instanceof WT_FlightPlanDirectToWaypointLeg) && this.fix.uniqueID === other.fix.uniqueID;
    }
}

class WT_FlightPlanProcedureLeg extends WT_FlightPlanWaypointFixLeg {
    /**
     * @param {WT_ProcedureLeg} procedureLeg
     * @param {WT_Waypoint} fix
     * @param {WT_FlightPlanLegStep} firstStep
     * @param {Boolean} isAltitudeSuppressed
     * @param {WT_NumberUnit} [advisoryAltitude]
     * @param {WT_NumberUnit} [customAltitude]
     * @param {WT_FlightPlanElement} [parent]
     * @param {WT_FlightPlan.Segment} [segment]
     */
    constructor(procedureLeg, fix, firstStep, isAltitudeSuppressed, advisoryAltitude, customAltitude, parent, segment) {
        super(fix, firstStep, isAltitudeSuppressed, procedureLeg.altitudeConstraint, advisoryAltitude, customAltitude, parent, segment);

        this._procedureLeg = procedureLeg;
    }

    /**
     * @readonly
     * @property {WT_ProcedureLeg} airport
     * @type {WT_ProcedureLeg}
     */
    get procedureLeg() {
        return this._procedureLeg;
    }

    /**
     * @readonly
     * @property {Boolean} discontinuity
     * @type {Boolean}
     */
    get discontinuity() {
        return this.procedureLeg.discontinuity;
    }

    copy() {
        return new WT_FlightPlanProcedureLeg(this.procedureLeg, this.fix, this.firstStep().copy(), this.altitudeConstraint.isSuppressed, this.altitudeConstraint.advisoryAltitude, this.altitudeConstraint.customAltitude, null, this._segment);
    }

    equals(other) {
        return (other instanceof WT_FlightPlanProcedureLeg) && super.equals(other);
    }
}

class WT_FlightPlanSequence extends WT_FlightPlanElement {
    constructor(parent, segment, elements) {
        super(parent, segment);
        /**
         * @type {WT_FlightPlanElement[]}
         */
        this._elements = [];
        this._elementsReadOnly = new WT_ReadOnlyArray(this._elements);

        if (elements) {
            this._insertMultiple(elements);
        }
        this._update();
    }

    /**
     * @readonly
     * @type {WT_GeoPointReadOnly}
     */
    get endpoint() {
        return this._elements.length > 0 ? this._elements[this._elements.length - 1].endpoint : (this._prev ? this._prev.endpoint : null);
    }

    /**
     * @readonly
     * @type {Number}
     */
    get desiredTrack() {
        return undefined;
    }

    /**
     * @readonly
     * @type {Number}
     */
    get length() {
        return this._elements.length;
    }

    /**
     * @readonly
     * @type {WT_ReadOnlyArray<WT_FlightPlanElement>}
     */
    get elements() {
        return this._elementsReadOnly;
    }

    _updateDistance() {
        this._distance.set(0);
        for (let i = 0; i < this._elements.length; i++) {
            let current = this._elements[i];
            let prev = i === 0 ? this._prev : this._elements[i - 1];
            current._setPrevious(prev);
            this._distance.add(current.distance);
        }
    }

    _updateLegs() {
        this._legs.splice(0, this._legs.length);
        this._elements.forEach(element => this._legs.push(...element.legs), this);
    }

    _update() {
        super._update();

        this._updateLegs();
    }

    _insert(element, index) {
        if (index === undefined) {
            index = this._elements.length;
        }
        this._elements.splice(index, 0, element);
        element._setParent(this);
        this._update();
    }

    _insertMultiple(elements, index) {
        if (index === undefined) {
            index = this._elements.length;
        }
        this._elements.splice(index, 0, ...elements);
        elements.forEach(element => element._setParent(this), this);
        this._update();
    }

    _remove(element) {
        let index = this._elements.indexOf(element);
        if (index >= 0) {
            this.removeByIndex(index);
        }
    }

    _removeByIndex(index, count = 1) {
        let removed = this._elements.splice(index, count);
        removed.forEach(element => element._setParent(null));
        this._update();
    }

    _clear() {
        this._removeByIndex(0, this._elements.length);
    }

    _copyElements() {
        return this._elements.map(element => element.copy());
    }

    copy() {
        return new WT_FlightPlanSequence(this._copyElements(), null, this._segment);
    }

    equals(other) {
        if (!(other instanceof WT_FlightPlanSequence)) {
            return false;
        }
        if (this.length !== other.length) {
            return false;
        }

        for (let i = 0; i < this._elements.length; i++) {
            if (!this._elements[i].equals(other._elements[i])) {
                return false;
            }
        }
        return true;
    }
}

class WT_FlightPlanAirwaySequence extends WT_FlightPlanSequence {
    constructor(airway, legs, parent, segment) {
        super(parent, segment, legs);
        this._airway = airway;
    }

    /**
     * @readonly
     * @type {WT_Airway}
     */
    get airway() {
        return this._airway;
    }

    copy() {
        return new WT_FlightPlanAirwaySequence(this.airway, this._copyElements(), null, this._segment);
    }
}

class WT_FlightPlanSegment extends WT_FlightPlanSequence {
    _setFlightPlan(flightPlan) {
        this._flightPlan = flightPlan;
    }
}

class WT_FlightPlanOriginDest extends WT_FlightPlanSegment {
    constructor(waypoint, segment) {
        super(null, segment);

        this._setWaypoint(waypoint);
    }

    /**
     * @readonly
     * @type {WT_Waypoint}
     */
    get waypoint() {
        return this._elements.length > 0 ? this._elements[0].fix : null;
    }

    /**
     *
     * @returns {WT_FlightPlanLeg}
     */
    leg() {
        return this._elements.length > 0 ? this._elements[0] : null;
    }
}

class WT_FlightPlanOrigin extends WT_FlightPlanOriginDest {
    constructor(waypoint) {
        super(waypoint, WT_FlightPlan.Segment.ORIGIN);
    }

    _setWaypoint(waypoint) {
        this._clear();
        if (waypoint) {
            this._insert(new WT_FlightPlanInitialWaypointLeg(waypoint, true, null, null, null, this), 0);
        }
    }

    copy() {
        return new WT_FlightPlanOrigin(this.waypoint);
    }

    equals(other) {
        return other instanceof WT_FlightPlanOrigin &&
               ((this.waypoint && other.waypoint && this.waypoint.uniqueID === other.waypoint.uniqueID) || this.waypoint === null && other.waypoint === null);
    }
}

class WT_FlightPlanDestination extends WT_FlightPlanOriginDest {
    constructor(waypoint) {
        super(waypoint, WT_FlightPlan.Segment.DESTINATION);
    }

    _setWaypoint(waypoint) {
        this._clear();
        if (waypoint) {
            this._insert(new WT_FlightPlanDirectToWaypointLeg(waypoint, true, null, null, null, this), 0);
        }
    }

    copy() {
        return new WT_FlightPlanDestination(this.waypoint);
    }

    equals(other) {
        return other instanceof WT_FlightPlanDestination &&
               ((this.waypoint && other.waypoint && this.waypoint.uniqueID === other.waypoint.uniqueID) || this.waypoint === null && other.waypoint === null);
    }
}

class WT_FlightPlanEnroute extends WT_FlightPlanSegment {
    constructor() {
        super(null, WT_FlightPlan.Segment.ENROUTE);
    }
}

/**
 * @abstract
 * @template {WT_Procedure} T
 */
class WT_FlightPlanProcedureSegment extends WT_FlightPlanSegment {
    /**
     * @param {T} procedure
     * @param {WT_FlightPlan.Segment} segment
     * @param {WT_FlightPlanLeg[]} legs
     */
    constructor(procedure, segment, legs) {
        super(null, segment, legs);
        this._procedure = procedure;
    }

    /**
     * @readonly
     * @type {T}
     */
    get procedure() {
        return this._procedure;
    }
}

/**
 * @abstract
 * @template {WT_Departure|WT_Arrival} T
 * @extends WT_FlightPlanProcedureSegment<T>
 */
class WT_FlightPlanDepartureArrival extends WT_FlightPlanProcedureSegment {
    /**
     * @param {T} procedure
     * @param {Number} runwayTransitionIndex
     * @param {Number} enrouteTransitionIndex
     * @param {WT_FlightPlan.Segment} segment
     * @param {WT_FlightPlanLeg[]} legs
     */
    constructor(procedure, runwayTransitionIndex, enrouteTransitionIndex, segment, legs) {
        super(procedure, segment, legs);

        this._runwayTransitionIndex = runwayTransitionIndex;
        this._enrouteTransitionIndex = enrouteTransitionIndex;
    }

    /**
     * @readonly
     * @type {Number}
     */
    get runwayTransitionIndex() {
        return this._runwayTransitionIndex;
    }

    /**
     * @readonly
     * @type {Number}
     */
    get enrouteTransitionIndex() {
        return this._enrouteTransitionIndex;
    }
}

/**
 * @extends WT_FlightPlanDepartureArrival<WT_Departure>
 */
class WT_FlightPlanDeparture extends WT_FlightPlanDepartureArrival {
    /**
     * @param {WT_Departure} departure
     * @param {Number} runwayTransitionIndex
     * @param {Number} enrouteTransitionIndex
     * @param {WT_FlightPlanLeg[]} legs
     */
    constructor(departure, runwayTransitionIndex, enrouteTransitionIndex, legs) {
        super(departure, runwayTransitionIndex, enrouteTransitionIndex, WT_FlightPlan.Segment.DEPARTURE, legs);
    }

    copy() {
        return new WT_FlightPlanDeparture(this.procedure, this.runwayTransitionIndex, this.enrouteTransitionIndex, this._copyElements());
    }

    equals(other) {
        return other instanceof WT_FlightPlanDeparture &&
               this.procedure.name === other.procedure.name &&
               this.procedure.airport.icao === other.procedure.airport.icao &&
               this.runwayTransitionIndex === other.runwayTransitionIndex &&
               this.enrouteTransitionIndex === other.enrouteTransitionIndex &&
               super.equals(other);
    }
}

/**
 * @extends WT_FlightPlanDepartureArrival<WT_Arrival>
 */
class WT_FlightPlanArrival extends WT_FlightPlanDepartureArrival {
    /**
     * @param {WT_Arrival} departure
     * @param {Number} runwayTransitionIndex
     * @param {Number} enrouteTransitionIndex
     * @param {WT_FlightPlanLeg[]} legs
     */
    constructor(arrival, runwayTransitionIndex, enrouteTransitionIndex, legs) {
        super(arrival, runwayTransitionIndex, enrouteTransitionIndex, WT_FlightPlan.Segment.ARRIVAL, legs);
    }

    copy() {
        return new WT_FlightPlanArrival(this.procedure, this.runwayTransitionIndex, this.enrouteTransitionIndex, this._copyElements());
    }

    equals(other) {
        return other instanceof WT_FlightPlanArrival &&
               this.procedure.name === other.procedure.name &&
               this.procedure.airport.icao === other.procedure.airport.icao &&
               this.runwayTransitionIndex === other.runwayTransitionIndex &&
               this.enrouteTransitionIndex === other.enrouteTransitionIndex &&
               super.equals(other);
    }
}

/**
 * @extends WT_FlightPlanProcedureSegment<WT_Approach>
 */
class WT_FlightPlanApproach extends WT_FlightPlanProcedureSegment {
    /**
     * @param {WT_Approach} departure
     * @param {Number} transitionIndex
     * @param {WT_FlightPlanLeg[]} legs
     */
    constructor(approach, transitionIndex, legs) {
        super(approach, WT_FlightPlan.Segment.APPROACH, legs);

        this._transitionIndex = transitionIndex;
    }

    /**
     * @readonly
     * @type {Number}
     */
    get transitionIndex() {
        return this._transitionIndex;
    }

    copy() {
        return new WT_FlightPlanApproach(this.procedure, this.transitionIndex, this._copyElements());
    }

    equals(other) {
        return other instanceof WT_FlightPlanApproach &&
               this.procedure.airport.icao === other.procedure.airport.icao &&
               this.procedure.name === other.procedure.name &&
               this.transitionIndex === other.transitionIndex &&
               super.equals(other);
    }
}

/**
 * A waypoint whose location is calculated as part of a flight plan.
 */
class WT_FlightPathWaypoint extends WT_CustomWaypoint {
    /**
     * @param {String} ident - the ident string for the new waypoint.
     * @param {WT_GeoPoint} location - the lat/long coordinates of the new waypoint.
     */
    constructor(ident, location) {
        super(ident, location);
    }

    /**
     * The name of this waypoint.
     * @readonly
     * @type {String}
     */
    get name() {
        return "";
    }
}

class WT_FlightPlanProcedureLegFactory {
    /**
     * @param {WT_ICAOWaypointFactory} icaoWaypointFactory
     */
    constructor(icaoWaypointFactory) {
        this._icaoWaypointFactory = icaoWaypointFactory;
        this._initLegMakers();
    }

    _initLegMakers() {
        this._legMakers = [];
        this._legMakers[WT_ProcedureLeg.Type.INITIAL_FIX] = new WT_FlightPlanInitialFixMaker(this._icaoWaypointFactory);
        this._legMakers[WT_ProcedureLeg.Type.FIX] = new WT_FlightPlanFlyToFixMaker(this._icaoWaypointFactory);
        this._legMakers[WT_ProcedureLeg.Type.FLY_HEADING_UNTIL_DISTANCE_FROM_REFERENCE] = new WT_FlightPlanFlyHeadingUntilDistanceFromReferenceMaker(this._icaoWaypointFactory);
        this._legMakers[WT_ProcedureLeg.Type.FLY_REFERENCE_RADIAL_FOR_DISTANCE] = new WT_FlightPlanFlyReferenceRadialForDistanceMaker(this._icaoWaypointFactory);
        this._legMakers[WT_ProcedureLeg.Type.FLY_HEADING_TO_INTERCEPT] = new WT_FlightPlanFlyHeadingToInterceptMaker(this._icaoWaypointFactory);
        this._legMakers[WT_ProcedureLeg.Type.FLY_HEADING_UNTIL_REFERENCE_RADIAL_CROSSING] = new WT_FlightPlanFlyHeadingUntilReferenceRadialCrossingMaker(this._icaoWaypointFactory);
        this._legMakers[WT_ProcedureLeg.Type.FLY_TO_BEARING_DISTANCE_FROM_REFERENCE] = new WT_FlightPlanFlyToBearingDistanceFromReferenceMaker(this._icaoWaypointFactory);
        this._legMakers[WT_ProcedureLeg.Type.FLY_HEADING_TO_ALTITUDE] = new WT_FlightPlanFlyHeadingToAltitudeMaker(this._icaoWaypointFactory);
        this._legMakers[WT_ProcedureLeg.Type.FLY_VECTORS] = new WT_FlightPlanFlyVectorsMaker(this._icaoWaypointFactory);
        this._legMakers[WT_ProcedureLeg.Type.INITIAL_RUNWAY_FIX] = new WT_FlightPlanRunwayFixMaker(this._icaoWaypointFactory);
        this._legMakers[WT_ProcedureLeg.Type.RUNWAY_FIX] = new WT_FlightPlanRunwayFixMaker(this._icaoWaypointFactory);
    }

    /**
     *
     * @param {WT_ProcedureLeg} procedureLeg
     * @returns {Promise<WT_FlightPlanProcedureLeg>}
     */
    async create(procedureLeg, previousEndpoint, nextLeg, parent, segment) {
        return this._legMakers[procedureLeg.type].create(procedureLeg, previousEndpoint, nextLeg, parent, segment);
    }
}

class WT_FlightPlanProcedureLegMaker {
    /**
     * @param {WT_ICAOWaypointFactory} icaoWaypointFactory
     */
    constructor(icaoWaypointFactory) {
        this._icaoWaypointFactory = icaoWaypointFactory;
    }

    /**
     * Parses a procedure leg definition to generate a terminator fix and a flight plan leg step sequence.
     * @param {WT_ProcedureLeg} procedureLeg - a procedure leg definition.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan, if any.
     * @param {WT_ProcedureLeg} nextLeg - the definition of the next procedure leg in the flight plan, if any.
     * @returns {Promise<{fix: WT_Waypoint, firstStep: WT_FlightPlanLegStep}>}
     */
    async _parse(procedureLeg, previousEndpoint, nextLeg) {
        return await Promise.resolve(undefined);
    }

    async create(procedureLeg, previousEndpoint, nextLeg, parent, segment) {
        let results = await this._parse(procedureLeg, previousEndpoint, nextLeg);
        return new WT_FlightPlanProcedureLeg(procedureLeg, results.fix, results.firstStep, null, null, parent, segment);
    }
}

class WT_FlightPlanRunwayFixMaker extends WT_FlightPlanProcedureLegMaker {
    /**
     * Parses a procedure leg definition to generate a terminator fix and a flight plan leg step sequence.
     * @param {WT_ProcedureRunwayFix} procedureLeg - a procedure leg definition.
     * @returns {Promise<{fix: WT_Waypoint, firstStep: WT_FlightPlanLegStep}>}
     */
    async _parse(procedureLeg) {
        let fix = procedureLeg.fix;
        let firstStep = procedureLeg.type === WT_ProcedureLeg.Type.INITIAL_RUNWAY_FIX ? new WT_FlightPlanLegInitialStep(fix.location) : new WT_FlightPlanLegDirectStep(fix.location);
        return {fix: fix, firstStep: firstStep};
    }
}

class WT_FlightPlanInitialFixMaker extends WT_FlightPlanProcedureLegMaker {
    /**
     * Parses a procedure leg definition to generate a terminator fix and a flight plan leg step sequence.
     * @param {WT_ProcedureInitialFix} procedureLeg - a procedure leg definition.
     * @returns {Promise<{fix: WT_Waypoint, firstStep: WT_FlightPlanLegStep}>}
     */
    async _parse(procedureLeg) {
        let fix = await this._icaoWaypointFactory.getWaypoint(procedureLeg.fixICAO);
        let firstStep = new WT_FlightPlanLegInitialStep(fix.location);
        return {fix: fix, firstStep: firstStep};
    }
}

class WT_FlightPlanProcedureLegDirectToFixMaker extends WT_FlightPlanProcedureLegMaker {
    /**
     * Calculates a terminator fix for a procedure leg.
     * @param {WT_ProcedureLeg} procedureLeg - a procedure leg.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan, if any.
     * @param {WT_ProcedureLeg} nextLeg - the definition of the next procedure leg in the flight plan, if any.
     * @returns {Promise<WT_Waypoint>} the terminator fix for the procedure leg.
     */
    async _calculateFix(procedureLeg, previousEndpoint, nextLeg) {
    }

    /**
     * Parses a procedure leg definition to generate a terminator fix and a flight plan leg step sequence.
     * @param {WT_ProcedureLeg} procedureLeg - a procedure leg definition.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan, if any.
     * @param {WT_ProcedureLeg} nextLeg - the definition of the next procedure leg in the flight plan, if any.
     * @returns {Promise<{fix: WT_Waypoint, firstStep: WT_FlightPlanLegStep}>}
     */
    async _parse(procedureLeg, previousEndpoint, nextLeg) {
        let fix = await this._calculateFix(procedureLeg, previousEndpoint, nextLeg);
        let firstStep = new WT_FlightPlanLegDirectStep(fix.location);
        return {fix: fix, firstStep: firstStep};
    }
}

class WT_FlightPlanProcedureLegHeadingToFixMaker extends WT_FlightPlanProcedureLegMaker {
    /**
     * Calculates a terminator fix for a procedure leg.
     * @param {WT_ProcedureLeg} procedureLeg - a procedure leg.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan, if any.
     * @param {WT_ProcedureLeg} nextLeg - the definition of the next procedure leg in the flight plan, if any.
     * @returns {Promise<WT_Waypoint>} the terminator fix for the procedure leg.
     */
    async _calculateFix(procedureLeg, previousEndpoint, nextLeg) {
    }

    /**
     * Parses a procedure leg definition to generate a terminator fix and a flight plan leg step sequence.
     * @param {WT_ProcedureLeg} procedureLeg - a procedure leg definition.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan, if any.
     * @param {WT_ProcedureLeg} nextLeg - the definition of the next procedure leg in the flight plan, if any.
     * @returns {Promise<{fix: WT_Waypoint, firstStep: WT_FlightPlanLegStep}>}
     */
    async _parse(procedureLeg, previousEndpoint, nextLeg) {
        let fix = await this._calculateFix(procedureLeg, previousEndpoint, nextLeg);
        let firstStep = new WT_FlightPlanLegHeadingStep(fix.location);
        return {fix: fix, firstStep: firstStep};
    }
}

class WT_FlightPlanFlyToFixMaker extends WT_FlightPlanProcedureLegDirectToFixMaker {
    /**
     * Calculates a terminator fix for a procedure leg.
     * @param {WT_ProcedureFlyToFix} procedureLeg - a procedure leg.
     * @returns {Promise<WT_Waypoint>} the terminator fix for the procedure leg.
     */
    async _calculateFix(procedureLeg) {
        return await this._icaoWaypointFactory.getWaypoint(procedureLeg.fixICAO);
    }
}

class WT_FlightPlanFlyHeadingUntilDistanceFromReferenceMaker extends WT_FlightPlanProcedureLegHeadingToFixMaker {
    /**
     * Calculates a terminator fix for a procedure leg.
     * @param {WT_ProcedureFlyHeadingUntilDistanceFromReference} procedureLeg - a procedure leg.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan.
     * @returns {Promise<WT_Waypoint>} the terminator fix for the procedure leg.
     */
    async _calculateFix(procedureLeg, previousEndpoint) {
        let reference = await this._icaoWaypointFactory.getWaypoint(procedureLeg.referenceICAO);
        let targetDistance = procedureLeg.distance.asUnit(WT_Unit.GA_RADIAN);
        let courseTrue = WT_GeoMagnetic.INSTANCE.magneticToTrue(procedureLeg.course, previousEndpoint);

        // because I'm not smart enough to derive the closed-form solution, we will approximate using small circle intersection,
        // then iterate to find the solution numerically
        let solutions = [new WT_GVector3(0, 0, 0), new WT_GVector3(0, 0, 0)];
        let path = WT_GreatCircle.createFromPointBearing(previousEndpoint, courseTrue);
        let circle = WT_SmallCircle.createFromPoint(reference.location, targetDistance);
        path.intersection(circle, solutions);
        if (solutions[0].length === 0) {
            throw new Error("Invalid procedure leg definition.");
        }

        let solution = WT_FlightPlanFlyHeadingUntilDistanceFromReferenceMaker._tempGeoPoint1.setFromCartesian(solutions[0]);
        if (solutions[1].length > 0) {
            let alternate = WT_FlightPlanFlyHeadingUntilDistanceFromReferenceMaker._tempGeoPoint2.setFromCartesian(solutions[1]);
            let headingTo1 = previousEndpoint.bearingTo(solution);
            let headingTo2 = previousEndpoint.bearingTo(alternate);
            let delta1 = Math.abs(headingTo1 - courseTrue);
            let delta2 = Math.abs(headingTo2 - courseTrue);
            delta1 = Math.min(delta1, 360 - delta1);
            delta2 = Math.min(delta2, 360 - delta2);
            if (delta2 < delta1) {
                solution = alternate;
            }
        }

        let a = previousEndpoint.distance(reference.location);
        let aSquared = a * a;
        solution = solution.set(previousEndpoint).offsetRhumb(courseTrue, b, true);
        let c = reference.location.distance(solution);
        let previousFixBearingFromOrigin = previousEndpoint.bearingFrom(reference.location);
        let theta = Math.abs(180 - (courseTrue - previousFixBearingFromOrigin)) * Avionics.Utils.DEG2RAD;
        let cosTheta = Math.cos(theta);
        while (Math.abs(c - targetDistance) > WT_FlightPlanFlyHeadingUntilDistanceFromReferenceMaker.FIX_TOLERANCE) {
            let b = previousEndpoint.distance(solution);
            let bSquared = b * b;

            let targetFactor = targetDistance / c;
            let term1 = a * b * cosTheta;
            let term2 = Math.sqrt(bSquared * (aSquared * cosTheta * cosTheta - aSquared + targetFactor * targetFactor * c * c));
            let bFactor1 = (term1 + term2) / bSquared;
            let bFactor2 = (term1 - term2) / bSquared;
            let bFactorSolution;
            if (bFactor1 > 0) {
                bFactorSolution = bFactor1;
            } else if (bFactor2 > 0) {
                bFactorSolution = bFactor2;
            } else {
                break;
            }
            solution = solution.set(previousEndpoint).offsetRhumb(courseTrue, b * bFactorSolution, true);
            c = reference.location.distance(solution);
        }

        return new WT_FlightPathWaypoint(`HDG${procedureLeg.course.toFixed(0).padStart(3, "0")}°`, solution);
    }
}
WT_FlightPlanFlyHeadingUntilDistanceFromReferenceMaker._tempGeoPoint1 = new WT_GeoPoint(0, 0);
WT_FlightPlanFlyHeadingUntilDistanceFromReferenceMaker._tempGeoPoint2 = new WT_GeoPoint(0, 0);
WT_FlightPlanFlyHeadingUntilDistanceFromReferenceMaker.FIX_TOLERANCE = WT_Unit.METER.convert(100, WT_Unit.GA_RADIAN);

class WT_FlightPlanFlyReferenceRadialForDistanceMaker extends WT_FlightPlanProcedureLegHeadingToFixMaker {
    /**
     * Calculates a terminator fix for a procedure leg.
     * @param {WT_ProcedureFlyReferenceRadialForDistance} procedureLeg - a procedure leg.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan.
     * @returns {Promise<WT_Waypoint>} the terminator fix for the procedure leg.
     */
    async _calculateFix(procedureLeg, previousEndpoint) {
        if (procedureLeg.fixICAO) {
            try {
                let fix = await this._icaoWaypointFactory.getWaypoint(procedureLeg.fixICAO);
                return fix;
            } catch (e) {}
        }

        let courseTrue = WT_GeoMagnetic.INSTANCE.magneticToTrue(procedureLeg.course, previousEndpoint);

        let targetDistance = procedureLeg.distance.asUnit(WT_Unit.GA_RADIAN);
        let fix = WT_FlightPlanFlyReferenceRadialForDistanceMaker._tempGeoPoint.set(previousEndpoint).offsetRhumb(courseTrue, targetDistance);

        return new WT_FlightPathWaypoint(`HDG${procedureLeg.course.toFixed(0).padStart(3, "0")}°`, fix);
    }
}
WT_FlightPlanFlyReferenceRadialForDistanceMaker._tempGeoPoint = new WT_GeoPoint(0, 0);

class WT_FlightPlanFlyHeadingToInterceptMaker extends WT_FlightPlanProcedureLegHeadingToFixMaker {
    /**
     * Calculates a terminator fix for a procedure leg.
     * @param {WT_ProcedureFlyHeadingToIntercept} procedureLeg - a procedure leg.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan.
     * @param {WT_ProcedureLeg} nextLeg - the definition of the next procedure leg in the flight plan.
     * @returns {Promise<WT_Waypoint>} the terminator fix for the procedure leg.
     */
    async _calculateFix(procedureLeg, previousEndpoint, nextLeg) {
        let reference;
        switch (nextLeg.type) {
            case WT_ProcedureLeg.Type.INITIAL_FIX:
            case WT_ProcedureLeg.Type.FLY_REFERENCE_RADIAL_FOR_DISTANCE:
                if (!nextLeg.fixICAO) {
                    break;
                }
            case WT_ProcedureLeg.Type.FIX:
                reference = await this._icaoWaypointFactory.getWaypoint(nextLeg.fixICAO);
                break;
        }

        if (!reference) {
            throw new Error("Invalid procedure leg definition.");
        }

        let courseTrue = WT_GeoMagnetic.INSTANCE.magneticToTrue(procedureLeg.course, previousEndpoint);
        let nextLegCourseTrue = WT_GeoMagnetic.INSTANCE.magneticToTrue(nextLeg.course, reference.location);

        let path = WT_RhumbLine.createFromPointBearing(previousEndpoint, courseTrue);
        let courseToIntercept = WT_RhumbLine.createFromPointBearing(reference.location, nextLegCourseTrue);

        let intersection = path.intersectionGeoPoint(courseToIntercept, WT_FlightPlanFlyHeadingToInterceptMaker._tempGeoPoint);
        if (!intersection) {
            throw new Error("Invalid procedure leg definition.");
        }

        return new WT_FlightPathWaypoint(`HDG${procedureLeg.course.toFixed(0).padStart(3, "0")}°`, intersection);
    }
}
WT_FlightPlanFlyHeadingToInterceptMaker._tempGeoPoint = new WT_GeoPoint(0, 0);

class WT_FlightPlanFlyHeadingUntilReferenceRadialCrossingMaker extends WT_FlightPlanProcedureLegHeadingToFixMaker {
    /**
     * Calculates a terminator fix for a procedure leg.
     * @param {WT_ProcedureFlyHeadingUntilReferenceRadialCrossing} procedureLeg - a procedure leg.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan.
     * @returns {Promise<WT_Waypoint>} the terminator fix for the procedure leg.
     */
    async _calculateFix(procedureLeg, previousEndpoint) {
        let reference = await this._icaoWaypointFactory.getWaypoint(procedureLeg.referenceICAO);
        let courseTrue = WT_GeoMagnetic.INSTANCE.magneticToTrue(procedureLeg.course, previousEndpoint);
        let radialTrue = WT_GeoMagnetic.INSTANCE.magneticToTrue(procedureLeg.radial, reference.location);

        let path = WT_RhumbLine.createFromPointBearing(previousEndpoint, courseTrue);
        let radial = WT_RhumbLine.createFromPointBearing(reference.location, radialTrue);

        let intersection = path.intersectionGeoPoint(radial, WT_FlightPlanFlyHeadingUntilReferenceRadialCrossingMaker._tempGeoPoint);
        if (!intersection) {
            throw new Error("Invalid procedure leg definition.");
        }

        return new WT_FlightPathWaypoint(`HDG${procedureLeg.course.toFixed(0).padStart(3, "0")}°`, intersection);
    }
}
WT_FlightPlanFlyHeadingUntilReferenceRadialCrossingMaker._tempGeoPoint = new WT_GeoPoint(0, 0);

class WT_FlightPlanFlyToBearingDistanceFromReferenceMaker extends WT_FlightPlanProcedureLegDirectToFixMaker {
    /**
     * Calculates a terminator fix for a procedure leg.
     * @param {WT_ProcedureFlyToBearingDistanceFromReference} procedureLeg - a procedure leg.
     * @returns {Promise<WT_Waypoint>} the terminator fix for the procedure leg.
     */
    async _calculateFix(procedureLeg) {
        if (procedureLeg.fixICAO) {
            try {
                let fix = await this._icaoWaypointFactory.getWaypoint(procedureLeg.fixICAO);
                return fix;
            } catch (e) {}
        }

        let reference = await this._icaoWaypointFactory.getWaypoint(procedureLeg.referenceICAO);
        let courseTrue = WT_GeoMagnetic.INSTANCE.magneticToTrue(procedureLeg.course, reference.location);

        let targetDistance = procedureLeg.distance.asUnit(WT_Unit.GA_RADIAN);
        let fix = WT_FlightPlanFlyToBearingDistanceFromReferenceMaker._tempGeoPoint.set(reference.location).offset(courseTrue, targetDistance);

        return new WT_FlightPathWaypoint(`${reference.ident}-R${procedureLeg.course.toFixed(0).padStart(3, "0")}-D${procedureLeg.distance.asUnit(WT_Unit.NMILE).toFixed(0)}`, fix);
    }
}
WT_FlightPlanFlyToBearingDistanceFromReferenceMaker._tempGeoPoint = new WT_GeoPoint(0, 0);

class WT_FlightPlanFlyHeadingToAltitudeMaker extends WT_FlightPlanProcedureLegHeadingToFixMaker {
    /**
     * Calculates a terminator fix for a procedure leg.
     * @param {WT_ProcedureFlyHeadingToAltitude} procedureLeg - a procedure leg.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan.
     * @returns {Promise<WT_Waypoint>} the terminator fix for the procedure leg.
     */
    async _calculateFix(procedureLeg, previousEndpoint) {
        let courseTrue = WT_GeoMagnetic.INSTANCE.magneticToTrue(procedureLeg.course, previousEndpoint);
        let targetDistance = procedureLeg.altitudeConstraint.floor.asUnit(WT_Unit.FOOT) / 500;
        let fix = previousEndpoint.offsetRhumb(courseTrue, WT_Unit.NMILE.convert(targetDistance, WT_Unit.GA_RADIAN));
        return new WT_FlightPathWaypoint(`${procedureLeg.altitudeConstraint.floor.asUnit(WT_Unit.FOOT).toFixed(0)}FT`, fix);
    }
}

class WT_FlightPlanFlyVectorsMaker extends WT_FlightPlanProcedureLegDirectToFixMaker {
    /**
     * Calculates a terminator fix for a procedure leg.
     * @param {WT_ProcedureFlyVectors} procedureLeg - a procedure leg.
     * @param {WT_GeoPoint} previousEndpoint - the endpoint of the previous leg in the flight plan.
     * @returns {Promise<WT_Waypoint>} the terminator fix for the procedure leg.
     */
    async _calculateFix(procedureLeg, previousEndpoint) {
        return new WT_FlightPathWaypoint("MANSEQ", previousEndpoint);
    }
}