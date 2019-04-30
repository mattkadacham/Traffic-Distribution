// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.
const nomis = require('./js/nomis.js')
const distribution = require('./js/distribution.js')
const geog = require('./data/geography.json')
const geog_all = require('./data/geography_all.json')
const utils = require('./js/utils.js')
const round = require('round-to')
const json2csv = require('json2csv').parse
const {dialog} = require('electron').remote
const fs = require('fs')
const Tabulator = require('tabulator-tables')

/*******************************************************
 *  Global vars
 ******************************************************/
var page = 1
var nextBtn = document.getElementById('next')
var p1 = document.getElementById('p1')
var p2 = document.getElementById('p2')
var p3 = document.getElementById('p3')
var p4 = document.getElementById('p4')
var p5 = document.getElementById('p5')
var tables = {}

/*******************************************************
 *  Global functions/eventListeners
 ******************************************************/

 // initialise() starts everything off and is called right at the end of this script
var initialise = () => {
    fillSelectOriginLA()
}

nextBtn.addEventListener('click', () => {
    page += 1
    nextPage()
})

var nextPage = () => {
    let selectedData
    switch (page) {
        case 2:
            removeAllPages()
            p2.style.display = 'flex'
            calcReg()
            console.log('Changed page to Reg Calc')
            break
        case 3:
            selectedData = tables.reg.getSelectedData()
            if (selectedData.length == 0) {
                alert('Select at least one region to break down into LAs')
                page -= 1
            } else {
                dist.commitSelected('reg', selectedData)
                removeAllPages()
                p3.style.display = 'flex'
                calcLA(selectedData)
                console.log('Changed page to LA Calc')
            }
            break
        case 4:
            selectedData = tables.la.getSelectedData()
            if (selectedData.length == 0) {
                alert('Select at least one LA to break down into MSOAs')
                page -= 1
            } else {
                dist.commitSelected('la', selectedData)
                removeAllPages()
                calcMSOA(selectedData)
                p4.style.display = 'flex'
                console.log('Changed page to MSOA Calc')
            }
            break
        case 5:
            dist.commitSelected('msoa', null)
            removeAllPages()
            p5.style.display = 'flex'
            console.log('Changed page to results page')
            showResults()
            break  
    }
}

var removeAllPages = () => {
    p1.style.display = 'none'
    p2.style.display = 'none'
    p3.style.display = 'none'
    p4.style.display = 'none'

}

/*******************************************************
 *  Dom Elements
 ******************************************************/

// "page" 1
var selectOriginLA = document.getElementById('la-select')
var selectOriginMSOA = document.getElementById('msoa-select')
var addAreaBtn = document.getElementById('add-area')
var selectedText = document.getElementById('selected-areas-text')

/*******************************************************
 *  Instantiate Classes
 ******************************************************/
var api = new nomis.Journeys()
var dist = new distribution.Distribution

/*******************************************************
 *  Page 1
 ******************************************************/

// Listeners
selectOriginLA.addEventListener('change', () => {
    if (selectOriginLA.value != 'null') {
        console.log(`LA selected: ${geog_all[selectOriginLA.value].name}, ${selectOriginLA.value}`)
        api.getChildren(selectOriginLA.value, childType='msoa', codeType='geogCode')
            .then((children) => {
                console.log(children)
                utils.clearDropDown(selectOriginMSOA, 'Choose MSOA')
                for (let child of children) {
                    utils.addToDropDown(child.name, child.geogCode, selectOriginMSOA)
                }
            })
            selectOriginMSOA.disabled = false
    }
})

addAreaBtn.addEventListener('click', () => {
    if (selectOriginMSOA.value != 'null' && !dist.origins.includes(selectOriginMSOA.value)) {
        dist.origins.push(selectOriginMSOA.value)
        console.log(`Added ${selectOriginMSOA.value} to origins`)
        console.log(`origins: \n ${dist.origins}`)
        selectedText.innerHTML += `${geog_all[selectOriginMSOA.value].name}<br>`
        nextBtn.disabled = false
    }
})

// Actions
var fillSelectOriginLA = () => {
    var namesCodesLA = []
    for (let key of Object.keys(geog.la)) {
        namesCodesLA.push([geog.la[key].name, key])
    }
    utils.sortStringArray(namesCodesLA)
    for (let entry of namesCodesLA) {
        utils.addToDropDown(entry[0], entry[1], selectOriginLA)
    }
    
}

/*******************************************************
 *  Table Pages
 ******************************************************/
// utilities for tabulator
function formatPercent(cell, formatterParams) {
    return `${round(cell._cell.value*100,1)}%`
}

function applyTabulator(divId, data) {
    let h = `${Math.min((data.length)*24 + 25, 360)}px`
    var table = new Tabulator('#' + divId,{
        layout: 'fitColumns',
        selectable: true,
        selectablePersistence: false,
        height: h,
        columns: [
            {title: 'Name', field: 'name'},
            {title: 'Code', field: 'code'},
            {title: 'Trips', field: 'trips'},
            {title: '%', field: 'proportion', formatter: formatPercent},
            {title: '% Adjusted', field: 'proportion_adjusted', formatter: formatPercent},
            {title: '% Adjusted', field: 'proportion_adjusted', formatter:"progress", formatterParams:{max:1, color:'#ff4a03'}}
        ]
    })
    return table
}


function applyResultsTabulator(divId) {
    var table = new Tabulator("#" + divId, {
        layout: 'fitColumns',
        height: '360px',
        columns: [
            {title: 'OD Type', field: 'odType'},
            {title: 'Name', field: 'name'},
            {title: 'Code', field: 'code'},
            {title: 'Area Type', field: 'areaType'},
            {title: 'Trips', field: 'trips'},
            {title: '%', field: 'proportion_final', formatter: formatPercent}
        ]
    })
    return table
}

// page 2 - Regions

var regSlider = document.getElementById("reg-slider")
var regValue = document.getElementById("reg-value")
regSlider.addEventListener('input', () => {
    regValue.innerHTML = `${regSlider.value}%`
    dist.recalcThreshold(regSlider.value/100)
    tables.reg.setData(dist.selected)
})

// page 3 - LAs
var laSlider = document.getElementById("la-slider")
var laValue = document.getElementById("la-value")
laSlider.addEventListener('input', () => {
    laValue.innerHTML = `${laSlider.value}%`
    dist.recalcThreshold(laSlider.value/100)
    tables.la.setData(dist.selected)
})

// page 4 - MSOAs
var msoaSlider = document.getElementById("msoa-slider")
var msoaValue = document.getElementById("msoa-value")
msoaSlider.addEventListener('input', () => {
    msoaValue.innerHTML = `${msoaSlider.value}%`
    dist.recalcThreshold(msoaSlider.value/100)
    tables.msoa.setData(dist.selected)
})


// Page 5 - results
var exportCsvBtn = document.getElementById('export-csv')
exportCsvBtn.addEventListener('click', () => {
    export_csv()
})

/*******************************************************
 *  Distribution Calcs
 ******************************************************/
var calcReg = () => {
    dist.getReg().then((selected) =>{
        table = applyTabulator("reg-table", dist.selected)
        table.setData(dist.selected)
        tables.reg = table
    })
}

var calcLA = (selectedAreas) => {
    dist.getLA(selectedAreas).then((selected) =>{
        table = applyTabulator("la-table", dist.selected)
        table.setData(dist.selected)
        tables.la = table
    })
}

var calcMSOA = (selectedAreas) => {
    dist.getMSOA(selectedAreas).then((selected) =>{
        table = applyTabulator("msoa-table", dist.selected)
        table.setData(dist.selected)
        tables.msoa = table
    })
}

var showResults = () => {
        dist.prepareFinal()
        console.log(dist.output)
        // _resultsCheck()

        dist.buildResultsData().then((data) => {
            table = applyResultsTabulator("results-table")
            table.setData(data)
            console.log(data)
            tables.results = table
        })
}

/*******************************************************
 *  Exports
 ******************************************************/

var export_csv = () => {
    results = dist.results
    var fields = ['name', 'code', 'areaType','odType', 'trips', 'proportion']
    var opts = {fields}

    var csv = json2csv(results, opts)
    console.log(csv)
    dialog.showSaveDialog({
        filters: [{
            name: 'csv',
            extensions: ['csv']
        }]},
        (filename) => {
            if (filename) {
                fs.writeFile(filename, csv, err => {
                    if (err != null) {
                        console.error(err)
                        alert(err)
                    }
                })
            }
        }
    )
}


/*******************************************************
 *  INITIALISE PAGE 1!!!
 ******************************************************/
initialise()


