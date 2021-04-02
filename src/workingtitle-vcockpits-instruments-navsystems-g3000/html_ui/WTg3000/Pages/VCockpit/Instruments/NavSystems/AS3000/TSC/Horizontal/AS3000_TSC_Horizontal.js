class AS3000_TSC_Horizontal extends AS3000_TSC {
    get templateID() { return "AS3000_TSC_Horizontal"; }

    connectedCallback() {
        super.connectedCallback();
        this.topKnobText = this.getChildById("SoftKey_1");
        this.bottomKnobText = this.getChildById("SoftKey_5");
    }

    parseXMLConfig() {
        super.parseXMLConfig();
        this.SwitchToMenuName("PFD");
    }

    _createSpeedBugsPage() {
        return new WT_G3000_TSCSpeedBugs("PFD");
    }

    _createPFDSettingsPage() {
        return new WT_G3000_TSCPFDSettings("PFD", "PFD Home", "PFD");
    }

    _createTrafficSettingsPage(halfPaneID) {
        return new WT_G3000_TSCTrafficSettings("MFD", "MFD Home", WT_G3x5_TrafficSystem.ID, "MFD", halfPaneID);
    }
}
registerInstrument("as3000-tsc-horizontal-element", AS3000_TSC_Horizontal);
//# sourceMappingURL=AS3000_TSC_Horizontal.js.map