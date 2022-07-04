/**
 *
 * (c) Copyright Ascensio System SIA 2020
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

let start = Date.now();
let allPlugins;                                                      // list of all plugins from config
let installedPlugins;                                                // list of intalled plugins
const configUrl = './config.json';                                   // url to config.json
const elements = {};                                                 // all elements
const isDesctop = window.AscDesktopEditor !== undefined;             // desctop detecting
const guidMarkeplace = 'asc.{AA2EA9B6-9EC2-415F-9762-634EE8D9A95E}'; // guid marketplace
const guidSettings = 'asc.{8D67F3C5-7736-4BAE-A0F2-8C7127DC4BB8}';   // guid settings plugins
const ioUrl = 'https://onlyoffice.github.io/sdkjs-plugins/content/'; // github.io url
let isPluginLoading = false;                                         // flag plugins loading
let loader;                                                          // loader
let themeType = detectThemeType();                                   // current theme
const lang = detectLanguage();                                       // current language
const shortLang = lang.split('-')[0];                                // short language
let bTranslate = false;                                              // flag translate or not
let isTranslationLoading = false;                                    // flag translation loading
let translate = {'Loading': 'Loading'};                              // translations for current language (thouse will necessary if we don't get tranlation file)

// it's necessary because we show loader before all (and getting translations too)
switch (shortLang) {
	case 'ru':
		translate["Loading"] = "Загрузка"
		break;
	case 'fr':
		translate["Loading"] = "Chargement"
		break;
	case 'es':
		translate["Loading"] = "Carga"
		break;
	case 'de':
		translate["Loading"] = "Laden"
		break;
	case 'cs':
		translate["Loading"] = "Načítání"
		break;
}

// it's necessary for loader (because it detects theme by this object)
window.Asc = {
	plugin : {
		theme : {
			type :  themeType
		}
	}
};

// get translation file
getTranslation();
// fetch all plugins from config
fetchAllPlugins();

window.onload = function() {
	// init element
	Ps = new PerfectScrollbar('#' + "div_main", {});
	initElemnts();

	if (shortLang == "en") {
		// if nothing to translate
		showMarketplace();
	}

	elements.btnMyPlugins.onclick = function(event) {
		// click on my plugins button
		toogleView(event.target, elements.btnMarketplace, 'Install plugin manually', false);
	};

	elements.btnMarketplace.onclick = function(event) {
		// click on marketplace button
		toogleView(event.target, elements.btnMyPlugins, 'Submit your own plugin', true);
	};

	elements.arrow.onclick = function() {
		// click on left arrow in preview mode
		document.getElementById('span_overview').click();
		elements.divSelected.classList.add('hidden');
		elements.divSelectedMain.classList.add('hidden');
		elements.divBody.classList.remove('hidden');
		elements.arrow.classList.add('hidden');
		Ps.update();
	};

	elements.close.onclick = function() {
		// click on close button
		console.log('close window');
	};

	if (isPluginLoading || isTranslationLoading) {
		toogleLoader(true, "Loading");
	}
};

window.addEventListener('message', function(message) {
	// getting messages from editor or plugin
	message = JSON.parse(message.data);
	let plugin;
	let installed;
	switch (message.type) {
		case 'InstalledPlugins':
			// TODO может быть в этом методе ещё передавать иконки в виде base64 (только чтобы были темы и scale нужно присылать сразу все)
			if (message.data) {
				installedPlugins = message.data.filter(function(el) {
					return (el.guid !== guidMarkeplace && el.guid !== guidSettings);
				});
			} else {
				installedPlugins = [];
			}

			// console.log('getInstalledPlugins: ' + (Date.now() - start));
			if (allPlugins)
				getAllPluginsData();
			
			break;
		case 'Installed':
			if (!message.guid) {
				// somethimes we can receive such message
				toogleLoader(false);
				return;
			}
			plugin = allPlugins.find(function(el){return el.guid === message.guid});
			installed = installedPlugins.find(function(el){return el.guid === message.guid});
			if (!installed && plugin) {
				installedPlugins.push(
					{
						baseUrl: plugin.url,
						guid: message.guid,
						canRemoved: true,
						obj: plugin,
						removed: false
					}
				);
				sortPlugins(false, true);
			} else if (installed) {
				installed.removed = false;
			}

			let btn = this.document.getElementById(message.guid).lastChild.lastChild;
			btn.innerHTML = translate['Remove'];
			btn.onclick = function(e) {
				onClickRemove(e.target);
			};

			if (!elements.divSelected.classList.contains('hidden')) {
				this.document.getElementById('btn_install').classList.add('hidden');
				this.document.getElementById('btn_remove').classList.remove('hidden');
			}

			toogleLoader(false);
			break;
		case 'Updated':
			if (!message.guid) {
				// somethimes we can receive such message
				toogleLoader(false);
				return;
			}
			installed = installedPlugins.find(function(el){return el.guid == message.guid});
			plugin = allPlugins.find(function(el){return el.guid === message.guid});

			installed.obj.version = plugin.version;

			if (!elements.divSelected.classList.contains('hidden')) {
				this.document.getElementById('btn_update').classList.add('hidden');
			}

			this.document.getElementById(message.guid).lastChild.firstChild.remove();
			toogleLoader(false);
			break;
		case 'Removed':
			if (!message.guid) {
				// somethimes we can receive such message
				toogleLoader(false);
				return;
			}
			plugin = allPlugins.find(function(el) {return el.guid === message.guid});
			installed = installedPlugins.find(function(el){return el.guid === message.guid});
			if (installed) {
				if (plugin) {
					installedPlugins = installedPlugins.filter(function(el){return el.guid !== message.guid});
				} else {
					installed.removed = true;
				}
			}

			if (elements.btnMyPlugins.classList.contains('primary')) {
				if (plugin) {
					showListofPlugins(false);
				} else {
					let btn = this.document.getElementById(message.guid).lastChild.lastChild;
					btn.innerHTML = translate['Install'];
					btn.onclick = function(e) {
						onClickInstall(e.target);
					};
				}
			} else {
				let btn = this.document.getElementById(message.guid).lastChild.lastChild;
				btn.innerHTML = translate['Install'];
				btn.onclick = function(e) {
					onClickInstall(e.target);
				};
				
				if (btn.parentNode.childElementCount > 1) {
					btn.parentNode.firstChild.remove();
				}
			}

			if (!elements.divSelected.classList.contains('hidden')) {
				this.document.getElementById('btn_remove').classList.add('hidden');
				this.document.getElementById('btn_install').classList.remove('hidden');
				this.document.getElementById('btn_update').classList.add('hidden');
			}

			toogleLoader(false);
			break;
		case 'Error':
			createError(message.error);
			toogleLoader(false);
			break;
		case 'Theme':
			if (message.theme.type)
				themeType = message.theme.type;

			let rule = '\n.asc-plugin-loader{background-color:' + message.theme['background-normal'] +';padding: 10px;display: flex;justify-content: center;align-items: center;border-radius: 5px;}';
			if (themeType.includes('light')) {
				this.document.getElementsByTagName('body')[0].classList.add('white_bg');
			}
			let styleTheme = document.createElement('style');
            styleTheme.type = 'text/css';
            styleTheme.innerHTML = message.style + rule;
            document.getElementsByTagName('head')[0].appendChild(styleTheme);
			break;
		case 'onExternalMouseUp':
			let evt = document.createEvent("MouseEvents");
			evt.initMouseEvent("mouseup", true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
			document.dispatchEvent(evt);
			break;
		case 'PluginReady':
			// get all installed plugins
			sendMessage({type: 'getInstalled'}, '*');
			break;
	};
}, false);

function getInstalledPluginsImages() {
	// get images as base64 for all intalled plugins
	let count = 0;
	installedPlugins.forEach(function(el, i, arr) {
		// skip if plugin is in maekreplace
		let plugin = allPlugins.find(function(pl){return pl.guid === el.guid}) || allPlugins.find(function(pl){return pl === el.obj.name.toLowerCase()});
		if (plugin)
			return;

		count++;
		let imageUrl = getImageUrl(el.obj, el);
		arr[i].obj.imageUrl = imageUrl;
		// пока убрал, так как нет смысла загружать картинки, если это не работает с http://
		// makeRequest(imageUrl, 'blob').then(
		// 	function (res) {
		// 		let reader = new FileReader();
		// 		reader.onloadend = function() {
		// 			arr[i].obj.imageUrl = reader.result;
		// 			count--;
		// 			if (!count) {
		// 				console.log('load all images = ' + (Date.now() - start));
		// 				// if (allPlugins) {
		// 					// getAllPluginsData();
		// 				// }
		// 			}				}
		// 		reader.readAsDataURL(res);
		// 	},
		// 	function(error) {
		// 		createError(error);
		// 	}
		// );
	});
};

function fetchAllPlugins() {
	// function for fetching all plugins from config
	isPluginLoading = true;
	makeRequest(configUrl).then(
		function(response) {
			allPlugins = JSON.parse(response);
			if (installedPlugins)
				getAllPluginsData();
		},
		function(err) {
			createError(new Error('Problem with loading markeplace config.'));
			isPluginLoading = false;
			allPlugins = [];
			showMarketplace();
		}
	);
};

function makeRequest(url, responseType) {
	// this function makes GET request and return promise
	// maybe use fetch to in this function
	// isLoading = true;
	return new Promise(function (resolve, reject) {
		try {
			let xhr = new XMLHttpRequest();
			xhr.open('GET', url, true);
			if (responseType)
				xhr.responseType = responseType;
			
			xhr.onload = function () {
				if (this.readyState == 4) {
					if (this.status == 200 || location.href.indexOf("file:") == 0) {
						resolve(this.response);
					}
					if (this.status >= 400) {
						reject(new Error(this.response));
					}
				}
			};

			xhr.onerror = function (err) {
				reject(err);
			};

			xhr.send(null);
		} catch (error) {
			reject(error);
		}
		
	});
};

function sendMessage(message) {
	// this function sends message to editor
	parent.postMessage(JSON.stringify(message), '*');
};

function detectLanguage() {
	// detect language or return default
	let lang = getUrlSearchValue("lang");
	if (lang.length == 2)
		lang = (lang.toLowerCase() + "-" + lang.toUpperCase());
	return lang || 'en-EN';
};

function detectThemeType() {
	// detect theme or return default
	let type = getUrlSearchValue("theme-type");
	return type || 'light';
};

function initElemnts() {
	elements.btnMyPlugins = document.getElementById('btn_myPlugins');
	elements.btnMarketplace = document.getElementById('btn_marketplace');
	elements.linkNewPlugin = document.getElementById('link_newPlugin');
	elements.divBody = document.getElementById('div_body');
	elements.divMain = document.getElementById('div_main');
	elements.arrow = document.getElementById('arrow');
	elements.close = document.getElementById('close');
	elements.divHeader = document.getElementById('div_header');
	elements.divSelected = document.getElementById('div_selected_toolbar');
	elements.divSelectedMain = document.getElementById('div_selected_main');
	elements.imgIcon = document.getElementById('img_icon');
	elements.spanName = document.getElementById('span_name');
	elements.spanOffered = document.getElementById('span_offered');
	elements.btnUpdate = document.getElementById('btn_update');
	elements.btnRemove = document.getElementById('btn_remove');
	elements.btnInstall = document.getElementById('btn_install');
	elements.spanSelectedDescr = document.getElementById('span_selected_description');
	elements.imgScreenshot = document.getElementById('image_screenshot');
	elements.linkPlugin = document.getElementById('link_plugin');
	elements.divScreen = document.getElementById("div_selected_image");
	elements.divGitLink = document.getElementById('div_github_link');
};

function toogleLoader(show, text) {
	// show or hide loader
	if (!show) {
		document.getElementById('loader-container').classList.add('hidden');
		loader && (loader.remove ? loader.remove() : $('#loader-container')[0].removeChild(loader));
		loader = undefined;	
	} else if(!loader) {
		document.getElementById('loader-container').classList.remove('hidden');
		loader && (loader.remove ? loader.remove() : $('#loader-container')[0].removeChild(loader));
		loader = showLoader($('#loader-container')[0], (translate[text] || text) + '...');
	}
};

function getAllPluginsData() {
	// get config file for each item in config.json
	getInstalledPluginsImages();
	isPluginLoading = true;
	let count = 0;
	let Unloaded = [];
	allPlugins.forEach(function(pluginUrl, i, arr) {
		count++;
		pluginUrl = (pluginUrl.indexOf(":/\/") == -1) ? pluginUrl = ioUrl + pluginUrl + '/' : pluginUrl;
		let confUrl = pluginUrl + 'config.json';
		makeRequest(confUrl).then(
			function(response) {
				count--;
				let config = JSON.parse(response);
				config.url = confUrl;
				config.baseUrl = pluginUrl;
				config.imageUrl = getImageUrl(config, null);
				arr[i] = config;
				if (!count) {
					// console.log('getAllPluginsData: ' + (Date.now() - start));
					removeUnloaded(Unloaded);
					sortPlugins(true, false);
					isPluginLoading = false;
					showMarketplace();
				}
			},
			function(err) {
				count--;
				Unloaded.push(i);
				createError(new Error('Problem with loading plugin config.\nConfig: ' + confUrl));
				if (!count) {
					removeUnloaded(Unloaded);
					sortPlugins(true, false);
					isPluginLoading = false;
					showMarketplace();
				}
			}
		);
	})
};

function showListofPlugins(bAll, sortedArr) {
	// show list of plugins
	elements.divMain.innerHTML = "";
	let arr = ( sortedArr ? sortedArr : (bAll ? allPlugins : installedPlugins) );
	if (arr.length) {
		arr.forEach(function(plugin) {
			if (plugin && plugin.guid)
				createPluginDiv(plugin, !bAll);
		});
		setTimeout(function(){Ps.update()});
	} else {
		// if no istalled plugins and my plugins button was clicked
		let notification = bAll ? 'Problem with loading plugins.' : 'No installed plugins.';
		createNotification(translate[notification]);
	}
};

function createPluginDiv(plugin, bInstalled) {
	// console.log('createPluginDiv');
	// this function creates div (preview) for plugins

	let div = document.createElement('div');
	div.id = plugin.guid;
	div.setAttribute('data-guid', plugin.guid);
	div.className = 'div_item';
	let installed = bInstalled ? plugin : installedPlugins.find(function(el){return(el.guid===plugin.guid)});
	let bHasUpdate = false;
	if (isDesctop && installed) {
		const installedV = (installed.obj.version ? installed.obj.version.split('.').join('') : 1);
		const lastV = (plugin.version ? plugin.version.split('.').join('') : installedV);
		if (lastV > installedV)
			bHasUpdate = true;
	}

	if (bInstalled) {
		plugin = allPlugins.find(function(el){
			return el.guid === plugin.guid
		});
	}
		

	if (!plugin) {
		plugin = installed.obj;
	}
	
	let variations = plugin.variations[0]
	// TODO подумать от куда брать цвет на фон под картинку (может в config добавить)
	let name = (bTranslate && plugin.nameLocale && plugin.nameLocale[shortLang]) ? plugin.nameLocale[shortLang] : plugin.name;
	let description = (bTranslate && variations.descriptionLocale && variations.descriptionLocale[shortLang]) ? variations.descriptionLocale[shortLang] : variations.description;
	let template = '<div class="div_image" onclick="onClickItem(event.target)">' +
						// временно поставил такие размеры картинки (чтобы выглядело симминтрично пока)
						'<img style="width:56px;" src="' + plugin.imageUrl + '">' +
					'</div>' +
					'<div class="div_description">'+
						'<span class="span_name">' + name + '</span>' +
						'<span class="span_description">' + description + '</span>' +
					'</div>' +
					'<div class="div_footer">' +
						(bHasUpdate
							? '<span class="span_update">' + translate["Update"] + '</span>'
							: ''
						)+''+
						( (installed && !installed.removed)
							? (installed.canRemoved ? '<button class="btn-text-default btn_install" onclick="onClickRemove(event.target)">' + translate["Remove"] + '</button>' : '<div style="height:20px"></div>')
							: '<button class="btn-text-default btn_install" onclick="onClickInstall(event.target)">'  + translate["Install"] + '</button>'
						)
						+
					'</div>';
	div.innerHTML = template;
	elements.divMain.append(div);
	Ps.update();
};

function onClickInstall(target) {
	// click install button
	toogleLoader(true, "Installation");
	let guid = target.parentNode.parentNode.getAttribute('data-guid');
	let plugin = allPlugins.find( function(el) { return el.guid === guid; } );
	let installed = installedPlugins.find( function(el) { return el.guid === guid; } );
	let message = {
		type : 'install',
		url : (plugin ? plugin.url : installed.baseUrl),
		guid : guid,
		config : plugin || installed.obj
	};
	sendMessage(message);
};

function onClickUpdate(target) {
	// click update button
	toogleLoader(true, "Updating");
	let guid = target.parentElement.parentElement.parentElement.getAttribute('data-guid');
	let plugin = allPlugins.find( function(el) { return el.guid === guid; } );
	let message = {
		type : 'update',
		url : plugin.url,
		guid : guid,
		config : plugin
	};
	sendMessage(message);
};

function onClickRemove(target) {
	// click remove button
	toogleLoader(true, "Removal");
	let guid = target.parentNode.parentNode.getAttribute('data-guid');
	let message = {
		type : 'remove',
		guid : guid
	};
	sendMessage(message);
};

function onClickItem(target) {
	// There we will make preview for selected plugin
	// TODO продумать где брать offered by и где брать текс для этого блока (может из конфига) (так же переводы для него надо добавить)
	let offered = " Ascensio System SIA";
	let description = "Correct French grammar and typography. The plugin uses Grammalecte, an open-source grammar and typographic corrector dedicated to the French language.Correct French grammar and typography."

	elements.divSelected.classList.remove('hidden');
	elements.divSelectedMain.classList.remove('hidden');
	elements.divBody.classList.add('hidden');
	elements.arrow.classList.remove('hidden');
	
	let guid = target.parentNode.getAttribute('data-guid');
	let divPreview = document.createElement('div');
	divPreview.id = 'div_preview';
	divPreview.className = 'div_preview';

	let installed = installedPlugins.find(function(el){return(el.guid===guid);});
	let plugin = allPlugins.find(function(el){return (el.guid == guid);});

	if (!plugin) {
		elements.divGitLink.classList.add('hidden');
		plugin = installed.obj;
	} else {
		elements.divGitLink.classList.remove('hidden');
	}

	let bHasUpdate = false;
	if (isDesctop && installed) {
		let installedV = installed.obj.version.split('.').join('');
		let lastV = plugin.version.split('.').join('');
		if (lastV > installedV)
			bHasUpdate = true;
	}

	let pluginUrl = plugin.baseUrl.replace('https://onlyoffice.github.io/', 'https://github.com/ONLYOFFICE/onlyoffice.github.io/tree/master/');
	// TODO проблема с тем, что в некоторых иконках плагинов есть отступ сверху, а в некоторых его нет (исходя их этого нужен разный отступ у span справа, чтобы верхние края совпадали)
	elements.divSelected.setAttribute('data-guid', guid);
	elements.imgIcon.setAttribute('src', target.children[0].src);
	elements.spanName.innerHTML = target.nextSibling.children[0].innerText;
	elements.spanOffered.innerHTML = offered;
	elements.spanSelectedDescr.innerHTML = description;
	elements.linkPlugin.setAttribute('href', pluginUrl);

	if (bHasUpdate) {
		elements.btnUpdate.classList.remove('hidden');
	} else {
		elements.btnUpdate.classList.add('hidden');
	}

	if (installed && !installed.removed) {
		if (installed.canRemoved) {
			elements.btnRemove.classList.remove('hidden');
		} else {
			elements.btnRemove.classList.add('hidden');
		}
		elements.btnInstall.classList.add('hidden');
	} else {
		elements.btnRemove.classList.add('hidden');
		elements.btnInstall.classList.remove('hidden');
	}

	if (plugin.variations[0].isVisual) {
		elements.imgScreenshot.setAttribute('src', './resources/img/screenshotes/' + guid + '.png');
		elements.imgScreenshot.classList.remove('hidden');
	} else {
		elements.imgScreenshot.classList.add('hidden');
	}

	setDivHeight();
};

function onSelectPreview(target, isOverview) {
	// change mode of preview
	if ( !target.classList.contains('span_selected') ) {
		$(".span_selected").removeClass("span_selected");
		target.classList.add("span_selected");

		if (isOverview) {
			document.getElementById('div_selected_info').classList.add('hidden');
			document.getElementById('div_selected_preview').classList.remove('hidden');
			setDivHeight();
		} else {
			document.getElementById('div_selected_preview').classList.add('hidden');
			document.getElementById('div_selected_info').classList.remove('hidden');
		}
	}
};

function createNotification(text) {
	// creates any notification for user inside elements.divMain window (you should clear this element before making notification)
	let div = document.createElement('div');
	div.className = 'div_notification';
	let span = document.createElement('span');
	span.className = 'span_notification';
	span.innerHTML = translate[text] || text;
	div.append(span);
	elements.divMain.append(div);
};

function createError(err) {
	// creates a modal window with error message for user and error in console
	console.error(err);
	let background = document.createElement('div');
	background.className = 'asc-plugin-loader';
	let span = document.createElement('span');
	span.className = 'error_caption';
	span.innerHTML = err.message;
	background.append(span);
	document.getElementById('div_error').append(background);
	document.getElementById('div_error').classList.remove('hidden');
	setTimeout(function() {
		// remove error after 5 seconds
		background.remove();
		document.getElementById('div_error').classList.add('hidden');
	}, 5000);
};

function setDivHeight() {
	// set height for div with image in preview mode
	if (Ps) Ps.update();
	// console.log(Math.round(window.devicePixelRatio * 100));
	if (elements.divScreen) {
		let height = elements.divScreen.parentNode.clientHeight - elements.divScreen.previousElementSibling.clientHeight - 40 + "px";
		elements.divScreen.style.height = height;
		elements.divScreen.style.maxHeight = height;
	}
};

window.onresize = function() {
	setDivHeight();
	// TODO change icons for plugins preview for new scale
};

function getTranslation() {
	// gets translation for current language
	if (shortLang != "en") {
		isTranslationLoading = true
		makeRequest('./translations/langs.json').then(
			function(response) {
				let arr = JSON.parse(response);
				let fullName, shortName;
				for (let i = 0; i < arr.length; i++) {
					let file = arr[i];
					if (file == lang) {
						fullName = file;
						break;
					} else if (file.split('-')[0] == shortLang) {
						shortName = file;
					}
				}
				if (fullName || shortName) {
					bTranslate = true;
					makeRequest('./translations/' + (fullName || shortName) + '.json').then(
						function(res) {
							// console.log('getTranslation: ' + (Date.now() - start));
							translate = JSON.parse(res);
							onTranslate();
						},
						function(err) {
							createError(new Error('Cannot load translation for current language.'));
							createDefaultTranslations();
						}
					);
				} else {
					createDefaultTranslations();
				}	
			},
			function(err) {
				createError(new Error('Cannot load translations list file.'));
				createDefaultTranslations();
			}
		);
	} else {
		createDefaultTranslations();
	}
};

function onTranslate() {
	isTranslationLoading = false;
	// translates elements on current language
	elements.linkNewPlugin.innerHTML = translate["Submit your own plugin"];
	elements.btnMyPlugins.innerHTML = translate["My plugins"];
	elements.btnMarketplace.innerHTML = translate["Marketplace"];
	elements.btnInstall.innerHTML = translate['Install'];
	elements.btnRemove.innerHTML = translate["Remove"];
	elements.btnUpdate.innerHTML = translate["Update"];
	document.getElementById('lbl_header').innerHTML = translate['Manage plugins'];
	document.getElementById('span_offered_caption').innerHTML = translate['Offered by'] + ': ';
	document.getElementById('span_overview').innerHTML = translate['Overview'];
	document.getElementById('span_info').innerHTML = translate['Info & Support'];
	document.getElementById('span_lern').innerHTML = translate['Learn how to use'] + ' ';
	document.getElementById('span_lern_plugin').innerHTML = translate['the plugin in'] + ' ';
	document.getElementById('span_contribute').innerHTML = translate['Contribute'] + ' ';
	document.getElementById('span_contribute_end').innerHTML = translate['to the plugin developmen or report an issue on'] + ' ';
	document.getElementById('span_help').innerHTML = translate['Get help'] + ' ';
	document.getElementById('span_help_end').innerHTML = translate['with the plugin functionality on our forum.'];
	document.getElementById('span_create').innerHTML = translate['Create a new plugin using'] + ' ';
	showMarketplace();
};

function showMarketplace() {
	// show main window to user
	if (!isPluginLoading && !isTranslationLoading) {
		showListofPlugins(true);
		toogleLoader(false);

	
		elements.divBody.classList.remove('hidden');
		// console.log('showMarketplace: ' + (Date.now() - start));
		// убираем пока шапку, так как в плагине есть своя
		// elements.divHeader.classList.remove('hidden');
	}
};

function getImageUrl(plugin, installed) {
	// get image url for current plugin
	// TODO решить вопрос со scale, чтобы выбирать нужную иконку
	let imageUrl;
	if ( installed && ( installed.baseUrl.includes('http://') || installed.baseUrl.includes('file:') ) ) {
		imageUrl = './resources/img/defaults/' + themeType + '/icon@2x.png';
	} else {
		if (plugin.baseUrl.includes('://')) {
			imageUrl = plugin.baseUrl;
		} else {
			let temp = plugin.baseUrl.replace(/\.\.\//g, '');
			let endpos = installed.baseUrl.indexOf('/', 9) + 1;
			imageUrl = installed.baseUrl.slice(0, endpos) + temp;
		}
		
		let variations = plugin.variations[0];
		if (variations.icons2) {
			let icon = variations.icons2[0];
			for (let i = 0; i < variations.icons2.length; i++) {
				if (themeType.includes(variations.icons2[i].style)) {
					icon = variations.icons2[i];
					break;
				}
			}
			imageUrl += icon['200%'].normal;
		} else if (!variations.isSystem && imageUrl != '') {
			let icon = variations.icons[0];
			if (typeof(icon) == 'object') {
				for (let i = 0; i < variations.icons.length; i++) {
					if (themeType.includes(variations.icons[i].style)) {
						icon = variations.icons[i];
						break;
					}
				}
				imageUrl += icon['200%'].normal;
			} else {
				imageUrl += variations.icons[0];
			}
		} else {
			imageUrl = './resources/img/defaults/' + themeType + '/icon@2x.png';
		}
	}
	return imageUrl;
};

function getUrlSearchValue(key) {
	let res = '';
	if (window.location && window.location.search) {
		let search = window.location.search;
		let pos1 = search.indexOf(key + '=');
		if (-1 != pos1) {
			pos1 += key.length + 1;
			let pos2 = search.indexOf("&", pos1);
			res = search.substring(pos1, (pos2 != -1 ? pos2 : search.length) )
		}
	}
	return res;
};

function toogleView(current, oldEl, text, bAll) {
	if ( !current.classList.contains('primary') ) {
		oldEl.classList.remove('submit', 'primary');
		current.classList.add('submit', 'primary');
		elements.linkNewPlugin.innerHTML = translate[text] || text;
		showListofPlugins(bAll);
	}
};

function sortPlugins(bAll, bInst) {
	if (bAll) {
		allPlugins.sort(function(a, b) {
			return a.name.localeCompare(b.name);
		});
	}
	if (bInst) {
		installedPlugins.sort(function(a, b) {
			return a.obj.name.localeCompare(b.obj.name);
		});
	}
};

function createDefaultTranslations() {
	translate = {
		"Submit your own plugin": "Submit your own plugin",
		"Install plugin manually": "Install plugin manually",
		"Install": "Install",
		"Remove": "Remove",
		"Update": "Update",
	};
	isTranslationLoading = false;
	showMarketplace();
};

function removeUnloaded(unloaded) {
	unloaded.forEach(function(el){
		allPlugins.splice(el, 1);
	})
};