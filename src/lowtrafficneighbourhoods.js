// Site implementation code

/*jslint browser: true, white: true, single: true, for: true */
/*global $, alert, console, window, osmtogeojson */

var lowtrafficneighbourhoods = (function ($) {
	
	'use strict';
	
	// Settings defaults
	var _settings = {
		
		// Application baseUrl
		baseUrl: '/map/',
		
		// CycleStreets API; obtain a key at https://www.cyclestreets.net/api/apply/
		apiBaseUrl: 'https://api.cyclestreets.net',
		apiKey: 'YOUR_API_KEY',
		
		// Mapbox API key
		mapboxApiKey: 'YOUR_MAPBOX_API_KEY',
		
		// Initial lat/lon/zoom of map and tile layer
		defaultLocation: {
			latitude: 53.366,
			longitude: -1.911,
			zoom: 6.15
		},
		defaultTileLayer: 'light',
		
		// Default layers ticked
		defaultLayers: ['ltnstatistics'],
		
		// Zoom position
		zoomPosition: 'top-left',
		
		// Geolocation position
		geolocationPosition: 'top-left',
	};
	
	// Layer definitions
	var _layerConfig = {
		
		// LTNs - modal filters
		modalfilters: {
			apiCall: '/v2/advocacydata.modalfilters',
			pointSize: {
				'base': 4,
				'stops': [
					[0, 4],
					[12, 6],
					[14, 12],
					[18, 20]
				]
			},
			pointColourApiField: 'colour',
			zoomInitialMin: 10,
			name: 'Modal filters',
			description: 'Type of modal filter:',
			legend: [
				['bollard', '#888'],
				['gate', '#952'],
				['gap', '#444'],
				['cycleway filter', '#a6a'],
				['bus gate', '#f33']
			],
			locateFeedbackButton: 'Modal filter here?',
			popupFeedbackButton: 'Not a modal filter?',
			popupHtml:
				  '<h2>Modal filter</h2>'
				+ '<table>'
				+ '<tr><td>Location:</td><td><strong>{properties.name}</strong></tr>'
				+ '<tr><td>Type:</td><td><strong>{properties.modalfilter}</strong></td></tr>'
				+ '<tr><td>OSM data:</td><td><a href="https://www.openstreetmap.org/{properties.osmType}/{properties.osmId}" target="_blank">View in OSM</a></tr>'
				+ '</table>'
				+ '{%streetview}'
		},
		
		// LTNs - streets
		ltns: {
			apiCall: '/v2/advocacydata.ltns',
			sendZoom: true,
			lineColourApiField: 'colour',
			lineWidthField: 'ratrun',
			lineWidthValues: {
				'main': 5,
				'yes': 3,
				'calmed': 3,
				'no': 3
			},
			zoomInitialMin: 10,
			name: 'LTNs',
			description: 'LTNs/rat-runs - experimental data',
			legend: [
				['LTN', '#8bb'],
				['Traffic-calmed', '#966'],
				['Rat-runs', '#d44'],
				['Main roads', '#888']
			],
			streetview: true,
			popupHtml:
				  '<table>'
				+ '<tr><td>Location:</td><td><strong>{properties.name}</strong></tr>'
				+ '<tr><td>Through-traffic possible?</td><td><strong>{properties.ratrun}</strong></td></tr>'
				+ '<tr><td>Traffic-calming?</td><td><strong>{properties.traffic_calmed}</strong></td></tr>'
				+ '<tr><td>OSM data:</td><td><a href="https://www.openstreetmap.org/way/{properties.osmId}" target="_blank">View in OSM</a></tr>'
				+ '</table>'
				+ '{%streetview}'
		},
		
		// LTNs - statistics
		ltnstatistics: {
			apiCall: '/v2/advocacydata.ltnstatistics',
			sendZoom: true,	// Allows geometry simplification and reduced data
			lineColour: 'purple',
			fillOpacity: 0.7,
			polygonColourField: 'noThroughStreetLengthPercent',
			polygonColourStops: [
				[80, '#030a92'],
				[70, '#313695'],
				[65, '#4575b4'],
				[60, '#abd9e9'],
				[55, '#fee090'],
				[50, '#f46d43'],
				[30, '#d73027'],
				[0, 'red']
			],
			legend: [
				['≥80%', '#030a92'],
				['≥70%', '#313695'],
				['≥65%', '#4575b4'],
				['≥60%', '#abd9e9'],
				['≥55%', '#fee090'],
				['≥50%', '#f46d43'],
				['≥30%', '#d73027'],
				['≥0%', 'red']
			],
			popupHtml:
				  '<h3>Area statistics</h3>'
				+ '<table>'
				+ '<tr><td>Highway authority:</td><td><strong>{properties.name}</strong></tr>'
				+ '<tr><td>Area type:</td><td><strong>{properties.area_description}</strong></tr>'
				+ '<tr><td>Census code:</td><td><strong>{properties.census_code}</strong></tr>'
				+ '<tr><td>Streets:</td><td><strong><a href="{properties.dataUrl}">Download GIS data</a></strong></tr>'
				+ '</table>'
				+ '<h4>Percentage of streets by length:</h4>'
				+ '<table>'
				+ '<tr><td width="175">Not through-traffic (LTN):</td><td><strong>{properties.noThroughStreetLengthPercent}%</strong></tr>'
				+ '<tr><td>Through-traffic possible:</td><td><strong>{properties.throughStreetLengthPercent}%</strong></tr>'
				+ '<tr><td>Through-traffic but with traffic calming:</td><td><strong>{properties.calmedThroughStreetLengthPercent}%</strong></tr>'
				+ '<tr><td>Main roads (C &amp; above):</td><td><strong>{properties.mainRoadLengthPercent}%</strong></tr>'
				+ '</table>'
				+ '<h4>Total length in metres:</h4>'
				+ '<table>'
				+ '<tr><td width="175">Not through-traffic (LTN):</td><td><strong>{properties.noThroughStreetLengthMetres}m</strong></tr>'
				+ '<tr><td>Through-traffic possible:</td><td><strong>{properties.throughStreetLengthMetres}m</strong></tr>'
				+ '<tr><td>Through-traffic possible but with traffic calming:</td><td><strong>{properties.calmedThroughStreetLengthMetres}m</strong></tr>'
				+ '<tr><td>Main roads (C &amp; above):</td><td><strong>{properties.mainRoadLengthMetres}m</strong></tr>'
				+ '</table>'
		},
		
		// Bolton modal filters data
		bolton: {
			apiCall: 'https://ltns.cyclestreets.net/bolton.geojson',
			style: {
				Point: {
					'circle-color': 'purple',
					'circle-radius': 10
				}
			},
			static: true,
			streetview: true
		},
		
		// Dublin bike lanes
		dublinbikelanes: {
			apiCall: 'https://ltns.cyclestreets.net/dublinbikelanes.geojson',
			style: {
				LineString: {
					'line-color': '#d8bfd8',
					'line-width': 3
				}
			},
			static: true,
			streetview: true
		},
		
		// OpenStreetMap; see: https://wiki.openstreetmap.org/wiki/API_v0.6
		osm: {
			apiCall: 'https://www.openstreetmap.org/api/0.6/map',	// Will return XML; see: https://wiki.openstreetmap.org/wiki/API_v0.6#Retrieving_map_data_by_bounding_box:_GET_.2Fapi.2F0.6.2Fmap
			apiKey: false,
			bbox: true,
			dataType: 'xml',
			minZoom: 17,
			fullZoom: 17,
			fullZoomMessage: 'OSM data is only available from zoom 17 - please zoom in further.',
			style: {
				LineString: {
					'line-color': 'purple',
					'line-width': 3
				}
			},
			convertData: function (osmXml) {
				var geojson = osmtogeojson (osmXml);		// Requires osmtogeojson from https://github.com/tyrasd/osmtogeojson/
				geojson.features = geojson.features.filter (function (feature) { return (feature.geometry.type == 'LineString') });	// See: https://stackoverflow.com/a/2722213
				return geojson;
			},
			popupHtml:
				  '<table>'
				+ '<tr><td>Name:</td><td><strong>{properties.name}</strong></td></tr>'
				+ '<tr><td>Highway:</td><td>{properties.highway}</td></tr>'
				+ '</table>'
				+ '<p>{%osmeditlink}</p>'
		}
	};
	
	
	return {
		
	// Public functions
		
		// Main function
		initialise: function (config)
		{
			// Merge the configuration into the settings
			$.each (_settings, function (setting, value) {
				if (config.hasOwnProperty(setting)) {
					_settings[setting] = config[setting];
				}
			});
			
			// Run the layerviewer for these settings and layers
			layerviewer.initialise (_settings, _layerConfig);
		}
	};
	
} (jQuery));

