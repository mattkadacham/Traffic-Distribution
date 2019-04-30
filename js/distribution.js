const geog = require('../data/geography.json')
const geog_all = require('../data/geography_all.json')
const nomis = require('./nomis.js')
const round =  require('round-to')


exports.Distribution = class {

    constructor() {
        this.origins = []
        this.destinations = []
        this.unselected = []
        this.selected = []
        this.api = new nomis.Journeys()
        this.output = {origin: [], region: [], la: [], msoa: []}
        this.regProportions = []
        this.laProportions = []
    }
    // main functions

    getReg() {
        return new Promise((resolve, reject) => {
            let regions = Object.values(geog.regions)
            this.api.journeyData(this.origins, regions.map(i => i.GeogCode))
            .then((result) => {
                this.destinations = result.destinations
                this._init_proportionCalc()
                this.filterCalc(0.01)
                this.proportionCalc()
                this.commitOrigins()
                resolve(this.selected)
            })
        })
    }

    getLA(selectedAreas) {
        return new Promise((resolve, reject) => {
            let getChildrenPromises = []
            for (let area of selectedAreas) {
                getChildrenPromises.push(this.api.getChildren(area.code, childType='la', codeType='geogCode'))
                this.regProportions.push(area.proportion_adjusted)
            }
            Promise.all(getChildrenPromises)
                .then((result) => {
                    var areas = []
                    for (let r of result) {
                        areas = areas.concat(r)
                    }
                    this.api.journeyData(this.origins, areas.map(i => i.geogCode))
                    .then((result) => {
                        this.destinations = result.destinations
                        this._init_proportionCalc()
                        this.filterCalc(0.01)
                        this.proportionCalc()
                        this.commitOrigins()
                        console.log('selected:')
                        console.log(this.selected)
                        resolve(this.selected)
                    })
                })
        })
    }

    getMSOA(selectedAreas) {
        return new Promise((resolve, reject) => {
            let getChildrenPromises = []
            for (let area of selectedAreas) {
                getChildrenPromises.push(this.api.getChildren(area.code, childType='msoa', codeType='geogCode'))
                this.laProportions.push(area.proportion_adjusted)
            }
            Promise.all(getChildrenPromises)
                .then((result) => {
                    var areas = []
                    for (let r of result) {
                        areas = areas.concat(r)
                    }
                    this.api.journeyData(this.origins, areas.map(i => i.geogCode))
                    .then((result) => {
                        this.destinations = result.destinations
                        this._init_proportionCalc()
                        this.filterCalc(0.01)
                        this.proportionCalc()
                        this.commitOrigins()
                        console.log('selected:')
                        console.log(this.selected)
                        resolve(this.selected)
                    })
                })
        })
    }

    // utilities
    recalcThreshold(threshold) {
        this.filterCalc(threshold)
        this.proportionCalc()
    }

    commitSelected(areaType, selectedData) {
        if (selectedData != null) {
            var selectedCodes = selectedData.map(i => i.code)
        }
        switch (areaType) {
            case 'reg':
            this.output.region = this.selected.filter(i => !selectedCodes.includes(i.code))
            break
            case 'la':
                this.output.la = this.selected.filter(i => !selectedCodes.includes(i.code))
                break
            case 'msoa':
                this.output.msoa = this.selected
                break
        }
    }

    retrieveSelected(areaType) {
        switch (areaType) {
            case 'reg':
                this.selected = this.output.region
                break
            case 'la':
                this.selected = this.output.la
                break
            case 'msoa':
                this.selected = this.output.msoa
                break
        }
    }

    commitOrigins() {
        this.output.origin = this.origins
    }

    filterCalc(threshold) {
        this.selected = []
        this.unselected = []
        for (let d of this.destinations) {
            if (d.proportion_adjusted < threshold) {
                this.unselected.push(d)
            } else {
                this.selected.push(d)
            }
        }
        return this.selected
    }

    _init_proportionCalc () {
        var totalTrips = 0
        for (let d of this.destinations) {
            totalTrips += d.trips
        }
        for (let d of this.destinations) {
            d.proportion = d.trips/totalTrips
            d.proportion_adjusted = d.trips/totalTrips
        }
        return this.destinations
    }

    proportionCalc () {
        var totalTrips = 0
        for (let d of this.selected) {
            totalTrips += d.trips
        }
        for (let d of this.selected) {
            d.proportion_adjusted = d.trips/totalTrips
        }
        return this.selected
    }

    filterLessThan1 (data) {
        this.filterCalc(data, 0.01)
    }

    prepareFinal () {
        this.addProportionFinal('region')
        this.addProportionFinal('la')
        this.addProportionFinal('msoa')
    }

    addProportionFinal (area) {
        let regProp = this.regProportions.reduce((a,b) => a + b)
        let laProp = this.laProportions.reduce((a,b) => a + b)
        switch (area) {
            case 'region':
                var multiplier = 1
                break
            case 'la':
                var multiplier = regProp
                break
            case 'msoa':
                var multiplier = regProp*laProp
                break
        }
        for (let i of this.output[area]) {
            i.proportion_final = i.proportion_adjusted*multiplier
        }
    }

    buildResultsData () {
        return new Promise((resolve, reject) => {
            var tableData = []
            for (let msoa of this.output.msoa) {
                if (this.output.origin.includes(msoa.code)) {
                    msoa.odType = 'Origin'
                    msoa.areaType = 'MSOA'
                    msoa.proportion = msoa.proportion_final
                } else {
                    msoa.odType = 'Destination'
                    msoa.areaType = 'MSOA'
                    msoa.proportion = msoa.proportion_final
                }
            }
            this.output.la = this.output.la.map((i) => {
                i.odType = 'Destination'
                i.areaType = 'LA'
                i.proportion = i.proportion_final
                return i
            })
            this.output.region = this.output.region.map((i) => {
                i.odType = 'Destination'
                i.areaType = 'REGION'
                i.proportion = i.proportion_final
                return i
            })
            for (let msoa of this.output.msoa) {
                tableData.push(msoa)
            }
            for (let la of this.output.la) {
                tableData.push(la)
            }
            for (let region of this.output.region) {
                tableData.push(region)
            }
            // console.log(tableData)
            console.log('=============!!!!!!!=================')
            let tripsum = tableData.map(i => i.trips).reduce((a,b) => a + b)
            for (let i of tableData) {
                i.proportion = round(i.trips/tripsum, 4)
            }

            this.results = tableData
            resolve(tableData)
        })
    }

}