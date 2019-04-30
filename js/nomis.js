const axios = require('axios')
// const geog = require('../data/geography.json')
const geog_all = require('../data/geography_all.json')


exports.Journeys = class {
	constructor () {
		this.dataset_code = 'NM_1208_1'
		this.journeysEndpoint = `https://www.nomisweb.co.uk/api/v01/dataset/${this.dataset_code}.data.json`
		this.baseUrl = `https://www.nomisweb.co.uk/api/v01/dataset/${this.dataset_code}/`
	}

	// Main function for getting journey to work data
	journeyData(originCodes, destinationCodes) {
		return new Promise((resolve, reject) => {
			var p = this.journeyParams(originCodes, destinationCodes)
			this.getData(p).then((response) => {
				resolve(this.parseData(response))
			})
		})
	}

	// helper fn: get child areas using parents geogcode or value
	getChildren(code, childType='msoa', codeType='geogCode') {
		return new Promise((resolve, reject) => {
			switch (childType) {
				case 'msoa':
					var typeCode = 'TYPE297'
					break
				case 'la':
					var typeCode = 'TYPE270'
					break
			}

			switch (codeType) {
				case 'geogCode':
					var geogValue = this.codes2Values([code])[0]
					break
				case 'value':
					var geogValue = code
					break
			}
			console.log(`typeCode: ${typeCode}`)
			console.log(`childType: ${childType}`)
			console.log(`getting children of ${code}, geogValue = ${geogValue}`)
			var url = this.baseUrl + `usual_residence/${geogValue}${typeCode}.def.sdmx.json`
			console.log(url)
			axios.get(url).then((response) => {
				var codeArr = this.parseChildrenResponse(response)
				resolve(codeArr)
			})
		})
	}

	// helper fn: parses response from getChildren()
	parseChildrenResponse (response) {
		var codeArr = []
		var codeList = response.data.structure.codelists.codelist[0].code
		console.log('found children:')
		console.log(codeList.map(code => code.annotations.annotation[2].annotationtext))
		for (let code of codeList) {
			codeArr.push({
				name: code.description.value,
				geogCode: code.annotations.annotation[2].annotationtext,
				value: code.value
			})
		}
		return codeArr
	}

	// returns REST parameters for the journey to work request
	journeyParams(originCodes, destinationCodes) {
		if (originCodes.length > 1) {
		var origin = `MAKE|${originCodes.join(',')}|${this.codes2Values(originCodes).join(';')}`
		} else {
			var origin = originCodes[0]
		}
		var params = {
			date: 'latest',
			usual_residence: origin,
			place_of_work: this.codes2Values(destinationCodes).join(','),
			transport_powpew11: 7,
			measures: 20100
		}
		return params
	}

	// util: convert array of geogCodes to their nomis values
	codes2Values(codesArray) {
		return codesArray.map(i =>  geog_all[i].value)
	}

	// axios wrapper
	getData(paramObject, url=this.journeysEndpoint) {
		return new Promise ((resolve, reject) => {
			axios.get(url, {
				params: paramObject
			})
			.then((response) => {
				resolve(response.data)
			})
		})
	}

	// pull out necessary data from nomis response (journeys to work data)
	parseData (response) {
		var data = {
			origin: {
				name: response.obs[0].usual_residence.description,
				code: response.obs[0].usual_residence.geogcode
			},
			destinations: []
		}
		for (let ob of response.obs) {
			data.destinations.push(this.parseObservation(ob))
		}
		return data
	}

	// helper fn for parseData()
	parseObservation(ob) {
		var res = {
			name: ob['place_of_work']['description'],
			code: ob['place_of_work']['geogcode'],
			trips: ob['obs_value']['value']

		}
		return res
	}
}

