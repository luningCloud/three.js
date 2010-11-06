/**
 * @author alteredq / http://alteredqualia.com/
 */

THREE.Loader = function() {
};

THREE.Loader.prototype = {
	
	// Load models generated by Blender exporter and original OBJ converter (converter_obj_three.py)
	
	loadAsciiOld: function( url, callback ) {
		
		var element = document.createElement( 'script' );
		element.type = 'text/javascript';
		element.onload = callback;
		element.src = url;
		document.getElementsByTagName( "head" )[ 0 ].appendChild( element );

	},

	// Load models generated by slim OBJ converter with ASCII option (converter_obj_three_slim.py -t ascii)
	//  - urlbase parameter is optional (it only applies to models with textures)
	
	loadAscii: function ( url, callback, urlbase ) {
		
		var s = (new Date).getTime(),
			worker = new Worker( url );

		worker.onmessage = function( event ) {
		
			THREE.Loader.prototype.createModel( event.data, callback, urlbase );
			
		};
		
		worker.postMessage( s );
		
	},
	
	// Load models generated by slim OBJ converter with BINARY option (converter_obj_three_slim.py -t binary)
	//  - urlbase parameter is mandatory (it applies to all models, it tells where to find the file with binary buffers)
	//  - binary models consist of two files: JS and BIN
	
	loadBinary: function( url, callback, urlbase ) {
		
		// #1 load JS part via web worker
		
		//  This isn't really necessary, JS part is tiny,
		//  could be done by more ordinary means.
		
		var s = (new Date).getTime(),
			worker = new Worker( url );

		worker.onmessage = function( event ) {
			
			var materials = event.data.materials,
				buffers = event.data.buffers;
			
			// #2 load BIN part via Ajax
			
			//  For some reason it is faster doing loading from here than from within the worker.
			//  Maybe passing of ginormous string as message between threads is costly? 
			//  Also, worker loading huge data by Ajax still freezes browser. Go figure, 
			//  worker with baked ascii JSON data keeps browser more responsive.
			
			THREE.Loader.prototype.loadAjaxBuffers( buffers, materials, callback, urlbase );
			
		};
		
		worker.onerror = function (event) {
			
			alert( "worker.onerror: " + event.message + "\n" + event.data );
			event.preventDefault();
			
		};
		
		worker.postMessage( s );
		
	},

	// Binary AJAX parser based on Magi binary loader
	// https://github.com/kig/magi
	
	// Should look more into HTML5 File API
	// See also other suggestions by Gregg Tavares
	// https://groups.google.com/group/o3d-discuss/browse_thread/thread/a8967bc9ce1e0978

	loadAjaxBuffers: function( buffers, materials, callback, urlbase ) {
	

		var xhr = new XMLHttpRequest(),
			url = urlbase + "/" + buffers;
	
		xhr.onreadystatechange = function() {
	  
			if ( xhr.readyState == 4 ) {
				
				if ( xhr.status == 200 || xhr.status == 0 ) {
		  
					THREE.Loader.prototype.createBinModel( xhr.responseText, callback, urlbase, materials );
					
				} else {
		  
					alert( "Couldn't load [" + url + "] [" + xhr.status + "]" );
					
				}
			}
		}
		
		xhr.open("GET", url, true);
		xhr.overrideMimeType("text/plain; charset=x-user-defined");
		xhr.setRequestHeader("Content-Type", "text/plain");
		xhr.send(null);
		
	},

	createBinModel: function ( data, callback, urlbase, materials ) {
		
		var Model = function ( urlbase ) {
			
			//var s = (new Date).getTime();
			
			var scope = this,
				currentOffset = 0, 
				md,
				normals = [];

			
			THREE.Geometry.call(this);
			
			init_materials();
			
			md = parseMetaData( data, currentOffset );
			currentOffset += md.header_bytes;
			
			currentOffset += init_vertices( currentOffset );
			currentOffset += init_normals( currentOffset );
			currentOffset += init_triangles_flat( currentOffset );
			currentOffset += init_triangles_smooth( currentOffset );
			currentOffset += init_quads_flat( currentOffset );
			currentOffset += init_quads_smooth( currentOffset );
			currentOffset += init_uvs_tri( currentOffset );
			
			init_uvs_quad( data, currentOffset, md.nuvtri );
			
			this.computeCentroids();
			this.computeNormals();
			
			//var e = (new Date).getTime();
			
			//log( "binary data parse time: " + (e-s) + " ms" );
			
			function parseMetaData( data, offset ) {
				
				var metaData = {
					'signature'               :parseString( data, offset, 8 ),
					
					'header_bytes'            :parseUChar8( data, offset + 8 ),
					'vertex_coordinate_bytes' :parseUChar8( data, offset + 9 ),
					'vertex_index_bytes'      :parseUChar8( data, offset + 10 ),
					'normal_index_bytes'      :parseUChar8( data, offset + 11 ),
					'material_index_bytes'    :parseUChar8( data, offset + 12 ),
					'normal_coordinate_bytes' :parseUChar8( data, offset + 13 ),
					'uv_coordinate_bytes'     :parseUChar8( data, offset + 14 ),
				
					'nvertices'    :parseUInt32( data, offset + 15 ),
					'ntri_flat'    :parseUInt32( data, offset + 15 + 4*1 ),
					'ntri_smooth'  :parseUInt32( data, offset + 15 + 4*2 ),
					'nquad_flat'   :parseUInt32( data, offset + 15 + 4*3 ),
					'nquad_smooth' :parseUInt32( data, offset + 15 + 4*4 ),
					'nnormals'     :parseUInt32( data, offset + 15 + 4*5 ),
					'nuvtri'       :parseUInt32( data, offset + 15 + 4*6 ),
					'nuvquad'      :parseUInt32( data, offset + 15 + 4*7 ),
				};

				/*
				log( "signature: " + metaData.signature );
				
				log( "header_bytes: " + metaData.header_bytes );
				log( "vertex_coordinate_bytes: " + metaData.vertex_coordinate_bytes );
				log( "vertex_index_bytes: " + metaData.vertex_index_bytes );
				log( "normal_index_bytes: " + metaData.normal_index_bytes );
				log( "material_index_bytes: " + metaData.material_index_bytes );
				log( "normal_coordinate_bytes: " + metaData.normal_coordinate_bytes );
				log( "uv_coordinate_bytes: " + metaData.uv_coordinate_bytes );
				
				log( "nvertices: " + metaData.nvertices );
				log( "ntri_flat: " + metaData.ntri_flat );
				log( "ntri_smooth: " + metaData.ntri_smooth );
				log( "nquad_flat: " + metaData.nquad_flat );
				log( "nquad_smooth: " + metaData.nquad_smooth );
				log( "nnormals: " + metaData.nnormals );
				log( "nuvtri: " + metaData.nuvtri );
				log( "nuvquad: " + metaData.nuvquad );
				*/
				
				return metaData;
				
			}
			
			function parseString( data, offset, length ) {
				
				return data.substr( offset, length );
				
			}
			
			function parseFloat32( data, offset ) {
				
				var b3 = parseUChar8( data, offset ),
					b2 = parseUChar8( data, offset + 1 ),
					b1 = parseUChar8( data, offset + 2 ),
					b0 = parseUChar8( data, offset + 3 ),
				
					sign = 1 - ( 2 * ( b0 >> 7 ) ),
					exponent = ((( b0 << 1 ) & 0xff) | ( b1 >> 7 )) - 127,
					mantissa = (( b1 & 0x7f ) << 16) | (b2 << 8) | b3;
					
					if (mantissa == 0 && exponent == -127)
						return 0.0;
					
					return sign * ( 1 + mantissa * Math.pow( 2, -23 ) ) * Math.pow( 2, exponent );

			}
			
			function parseUInt32( data, offset ) {
				
				var b0 = parseUChar8( data, offset ),
					b1 = parseUChar8( data, offset + 1 ),
					b2 = parseUChar8( data, offset + 2 ),
					b3 = parseUChar8( data, offset + 3 );
				
				return (b3 << 24) + (b2 << 16) + (b1 << 8) + b0;
			}
			
			function parseUInt16( data, offset ) {
				
				var b0 = parseUChar8( data, offset ),
					b1 = parseUChar8( data, offset + 1 );
				
				return (b1 << 8) + b0;
				
			}
			
			function parseSChar8( data, offset ) {
				
				var b = parseUChar8( data, offset );
				return b > 127 ? b - 256 : b;
				
			}
			
			function parseUChar8( data, offset ) {
				
				return data.charCodeAt( offset ) & 0xff;
			}
			
			function init_vertices( start ) {
				
				var i, x, y, z, 
					stride = md.vertex_coordinate_bytes * 3;
				
				for( i = 0; i < md.nvertices; ++i ) {
					
					x = parseFloat32( data, start + i*stride );
					y = parseFloat32( data, start + i*stride + md.vertex_coordinate_bytes );
					z = parseFloat32( data, start + i*stride + md.vertex_coordinate_bytes*2 );
					scope.vertices.push( new THREE.Vertex( new THREE.Vector3( x, y, z ) ) );
					
				}
				
				return md.nvertices * stride;
				
			}
			
			function init_triangles_flat( start ) {
				
				var i, a, b, c, m, material, 
					stride = md.vertex_index_bytes * 3 + md.material_index_bytes;
				
				for( i = 0; i < md.ntri_flat; ++i ) {
					
					a = parseUInt32( data, start + i*stride );
					b = parseUInt32( data, start + i*stride + md.vertex_index_bytes );
					c = parseUInt32( data, start + i*stride + md.vertex_index_bytes*2 );
					m = parseUInt16( data, start + i*stride + md.vertex_index_bytes*3 );
					
					material = scope.materials[ m ];
					scope.faces.push( new THREE.Face3( a, b, c, null, material ) );
					
				}
				
				return md.ntri_flat * stride;
				
			}
			
			function init_triangles_smooth( start ) {
			
				var i, a, b, c, m, na, nb, nc, material,
					nax, nay, naz, nbx, nby, nbz, ncx, ncy, ncz,
					stride = md.vertex_index_bytes * 3 + md.material_index_bytes + md.normal_index_bytes * 3;
				
				for( i = 0; i < md.ntri_smooth; ++i ) {
					
					a  = parseUInt32( data, start + i*stride );
					b  = parseUInt32( data, start + i*stride + md.vertex_index_bytes );
					c  = parseUInt32( data, start + i*stride + md.vertex_index_bytes*2 );
					m  = parseUInt16( data, start + i*stride + md.vertex_index_bytes*3 );
					na = parseUInt32( data, start + i*stride + md.vertex_index_bytes*3 + md.material_index_bytes );
					nb = parseUInt32( data, start + i*stride + md.vertex_index_bytes*3 + md.material_index_bytes + md.normal_index_bytes );
					nc = parseUInt32( data, start + i*stride + md.vertex_index_bytes*3 + md.material_index_bytes + md.normal_index_bytes*2 );
					
					material = scope.materials[ m ];
					
					nax = normals[ na*3     ],
					nay = normals[ na*3 + 1 ],
					naz = normals[ na*3 + 2 ],
				
					nbx = normals[ nb*3     ],
					nby = normals[ nb*3 + 1 ],
					nbz = normals[ nb*3 + 2 ],
				
					ncx = normals[ nc*3     ],
					ncy = normals[ nc*3 + 1 ],
					ncz = normals[ nc*3 + 2 ];
				
					scope.faces.push( new THREE.Face3( a, b, c, 
								  [new THREE.Vector3( nax, nay, naz ), 
								   new THREE.Vector3( nbx, nby, nbz ), 
								   new THREE.Vector3( ncx, ncy, ncz )], 
								  material ) );
					
				}
				
				return md.ntri_smooth * stride;
				
			}

			function init_quads_flat( start ) {
				
				var i, a, b, c, d, m, material,
					stride = md.vertex_index_bytes * 4 + md.material_index_bytes;;
				
				for( i = 0; i < md.nquad_flat; ++i ) {
					
					a = parseUInt32( data, start + i*stride );
					b = parseUInt32( data, start + i*stride + md.vertex_index_bytes );
					c = parseUInt32( data, start + i*stride + md.vertex_index_bytes*2 );
					d = parseUInt32( data, start + i*stride + md.vertex_index_bytes*3 );
					m = parseUInt16( data, start + i*stride + md.vertex_index_bytes*4 );
					
					material = scope.materials[ m ];
					scope.faces.push( new THREE.Face4( a, b, c, d, null, material ) );
					
				}
				
				return md.nquad_flat * stride;
				
			}

			function init_quads_smooth( start ) {
				
				var i, a, b, c, d, m, na, nb, nc, nd, material,
					nax, nay, naz, nbx, nby, nbz, ncx, ncy, ncz, ndx, ndy, ndz,
					stride = md.vertex_index_bytes * 4 + md.material_index_bytes + md.normal_index_bytes * 4;
				
				for( i = 0; i < md.nquad_smooth; ++i ) {
					
					a  = parseUInt32( data, start + i*stride );
					b  = parseUInt32( data, start + i*stride + md.vertex_index_bytes );
					c  = parseUInt32( data, start + i*stride + md.vertex_index_bytes*2 );
					d  = parseUInt32( data, start + i*stride + md.vertex_index_bytes*3 );
					m  = parseUInt16( data, start + i*stride + md.vertex_index_bytes*4 );
					na = parseUInt32( data, start + i*stride + md.vertex_index_bytes*4 + md.material_index_bytes );
					nb = parseUInt32( data, start + i*stride + md.vertex_index_bytes*4 + md.material_index_bytes + md.normal_index_bytes );
					nc = parseUInt32( data, start + i*stride + md.vertex_index_bytes*4 + md.material_index_bytes + md.normal_index_bytes*2 );
					nd = parseUInt32( data, start + i*stride + md.vertex_index_bytes*4 + md.material_index_bytes + md.normal_index_bytes*3 );
					
					material = scope.materials[ m ];
					
					nax = normals[ na*3     ],
					nay = normals[ na*3 + 1 ],
					naz = normals[ na*3 + 2 ],
				
					nbx = normals[ nb*3     ],
					nby = normals[ nb*3 + 1 ],
					nbz = normals[ nb*3 + 2 ],
				
					ncx = normals[ nc*3     ],
					ncy = normals[ nc*3 + 1 ],
					ncz = normals[ nc*3 + 2 ];

					ndx = normals[ nd*3     ],
					ndy = normals[ nd*3 + 1 ],
					ndz = normals[ nd*3 + 2 ];

					scope.faces.push( new THREE.Face4( a, b, c, d,
								  [new THREE.Vector3( nax, nay, naz ), 
								   new THREE.Vector3( nbx, nby, nbz ), 
								   new THREE.Vector3( ncx, ncy, ncz ),
								   new THREE.Vector3( ndx, ndy, ndz )], 
								  material ) );
				}
				
				return md.nquad_smooth * stride;
				
			}
			
			function init_uvs_tri( start ) {
				
				var i, ua, ub, uc, va, vb, vc, uv,
					stride = md.uv_coordinate_bytes * 6;
				
				for( i = 0; i < md.nuvtri; i++ ) {
					
					ua = parseFloat32( data, start + i*stride );
					va = parseFloat32( data, start + i*stride + 4 );
					
					ub = parseFloat32( data, start + i*stride + 8 );
					vb = parseFloat32( data, start + i*stride + 12 );
					
					uc = parseFloat32( data, start + i*stride + 16 );
					vc = parseFloat32( data, start + i*stride + 20 );
					
					uv = [];
					uv.push( new THREE.UV( ua, va ) );
					uv.push( new THREE.UV( ub, vb ) );
					uv.push( new THREE.UV( uc, vc ) );
					scope.uvs.push( uv );
					
				}
				
				return md.nuvtri * stride;
				
			}

			function init_uvs_quad( start ) {
				
				var i, ua, ub, uc, ud, va, vb, vc, vd, uv,
					stride = md.uv_coordinate_bytes * 8;
				
				for( i = 0; i < md.nuvquad; i++ ) {
					
					ua = parseFloat32( data, start + i*stride );
					va = parseFloat32( data, start + i*stride + 4 );
					
					ub = parseFloat32( data, start + i*stride + 8 );
					vb = parseFloat32( data, start + i*stride + 12 );
					
					uc = parseFloat32( data, start + i*stride + 16 );
					vc = parseFloat32( data, start + i*stride + 20 );

					ud = parseFloat32( data, start + i*stride + 24 );
					vd = parseFloat32( data, start + i*stride + 28 );
					
					uv = [];
					uv.push( new THREE.UV( ua, va ) );
					uv.push( new THREE.UV( ub, vb ) );
					uv.push( new THREE.UV( uc, vc ) );
					uv.push( new THREE.UV( ud, vd ) );
					scope.uvs.push( uv );
					
				}
				
				return md.nuvquad * stride;
				
			}
			
			function init_normals( start ) {
				
				var i, x, y, z, 
					stride = md.normal_coordinate_bytes * 3;
				
				for( i = 0; i < md.nnormals; ++i ) {
					
					x = parseSChar8( data, start + i*stride );
					y = parseSChar8( data, start + i*stride + md.normal_coordinate_bytes );
					z = parseSChar8( data, start + i*stride + md.normal_coordinate_bytes*2 );
					
					normals.push( x/127, y/127, z/127 );
					
				}
				
				return md.nnormals * stride;
				
			}
			
			function init_materials() {
				
				scope.materials = [];
				for( var i = 0; i < materials.length; ++i ) {
					scope.materials[i] = [ create_material( materials[i], urlbase ) ];
				}
				
				//log( "materials: " + scope.materials.length );
				
			}
			
			function is_pow2( n ) {
				
				var l = Math.log(n) / Math.LN2;
				return Math.floor(l) == l;
				
			}
			
			function nearest_pow2(n) {
				
				var l = Math.log(n) / Math.LN2;
				return Math.pow( 2, Math.round(l) );
				
			}
			
			function create_material( m ) {
				
				var material, texture, image, color;
				
				if( m.map_diffuse && urlbase ) {
					
					texture = document.createElement( 'canvas' );
					material = new THREE.MeshBitmapMaterial( texture );
					
					image = new Image();
					image.onload = function () {
						
						if ( !is_pow2( this.width ) || !is_pow2( this.height ) ) {
						
							var w = nearest_pow2( this.width ),
								h = nearest_pow2( this.height );
							
							material.bitmap.width = w;
							material.bitmap.height = h;
							material.bitmap.getContext("2d").drawImage( this, 0, 0, w, h );
							
						} else {
							
							material.bitmap = this;
							
						}
						
						material.loaded = 1;
						
					};
					
					image.src = urlbase + "/" + m.map_diffuse;
					
				} else if( m.col_diffuse ) {
					
					color = (m.col_diffuse[0]*255 << 16) + (m.col_diffuse[1]*255 << 8) + m.col_diffuse[2]*255;
					material = new THREE.MeshColorFillMaterial( color, m.transparency );
					
				} else if( m.a_dbg_color ) {
					
					material = new THREE.MeshColorFillMaterial( m.a_dbg_color );
					
				} else {
					
					material = new THREE.MeshColorFillMaterial( 0xeeeeee );
					
				}

				return material;
			}
			
			
		}
		
		Model.prototype = new THREE.Geometry();
		Model.prototype.constructor = Model;
		
		callback( new Model( urlbase ) );
		
	},
	
	createModel: function ( data, callback, urlbase ) {
		
		var Model = function ( urlbase ) {
			
			var scope = this;

			THREE.Geometry.call(this);
			
			init_materials();
			init_vertices();
			init_uvs();
			init_faces();
			
			this.computeCentroids();
			this.computeNormals();
			
			function init_vertices() {
			
				var i, l, x, y, z;
				
				for( i = 0, l = data.vertices.length/3; i < l; i++ ) {
					
					x = data.vertices[ i*3     ];
					y = data.vertices[ i*3 + 1 ];
					z = data.vertices[ i*3 + 2 ];
					v( x, y, z );
					
				}
			
			}

			function init_uvs() {
			
				var i, l, ua, ub, uc, ud, va, vb, vc, vd;
				
				for( i = 0, l = data.uvs_tri.length; i < l; i++ ) {
					
					ua = data.uvs_tri[ i*6     ];
					va = data.uvs_tri[ i*6 + 1 ];
					
					ub = data.uvs_tri[ i*6 + 2 ];
					vb = data.uvs_tri[ i*6 + 3 ];
					
					uc = data.uvs_tri[ i*6 + 4 ];
					vc = data.uvs_tri[ i*6 + 5 ];
					
					uv( ua, va, ub, vb, uc, vc );
					
				}
				
				for( i = 0, l = data.uvs_quad.length; i < l; i++ ) {
					
					ua = data.uvs_quad[ i*8     ];
					va = data.uvs_quad[ i*8 + 1 ];
					
					ub = data.uvs_quad[ i*8 + 2 ];
					vb = data.uvs_quad[ i*8 + 3 ];
					
					uc = data.uvs_quad[ i*8 + 4 ];
					vc = data.uvs_quad[ i*8 + 5 ];
					
					ud = data.uvs_quad[ i*8 + 6 ];
					vd = data.uvs_quad[ i*8 + 7 ];
					
					uv( ua, va, ub, vb, uc, vc, ud, vd );
				
				}
			
			}

			function init_faces() {
			
				var i, l, a, b, c, d, m, na, nb, nc, nd;

				for( i = 0, l = data.triangles.length/4; i < l; i++ ) {
					
					a = data.triangles[ i*4     ];
					b = data.triangles[ i*4 + 1 ];
					c = data.triangles[ i*4 + 2 ];
					
					m = data.triangles[ i*4 + 3 ];
					
					f3( a, b, c, m );
				
				}

				for( i = 0, l = data.triangles_n.length/7; i < l; i++ ) {
					
					a  = data.triangles_n[ i*7     ];
					b  = data.triangles_n[ i*7 + 1 ];
					c  = data.triangles_n[ i*7 + 2 ];
					
					m  = data.triangles_n[ i*7 + 3 ];
					
					na = data.triangles_n[ i*7 + 4 ];
					nb = data.triangles_n[ i*7 + 5 ];
					nc = data.triangles_n[ i*7 + 6 ];
					
					f3n( a, b, c, m, na, nb, nc );
				
				}
				
				for( i = 0, l = data.quads.length/5; i < l; i++ ) {
					
					a = data.quads[ i*5     ];
					b = data.quads[ i*5 + 1 ];
					c = data.quads[ i*5 + 2 ];
					d = data.quads[ i*5 + 3 ];
					
					m = data.quads[ i*5 + 4 ];
					
					f4( a, b, c, d, m );
					
				}

				for( i = 0, l = data.quads_n.length/9; i < l; i++ ) {
					
					a  = data.quads_n[ i*9     ];
					b  = data.quads_n[ i*9 + 1 ];
					c  = data.quads_n[ i*9 + 2 ];
					d  = data.quads_n[ i*9 + 3 ];
					
					m  = data.quads_n[ i*9 + 4 ];
					
					na = data.quads_n[ i*9 + 5 ];
					nb = data.quads_n[ i*9 + 6 ];
					nc = data.quads_n[ i*9 + 7 ];
					nd = data.quads_n[ i*9 + 8 ];
					
					f4n( a, b, c, d, m, na, nb, nc, nd );
				
				}
			
			}
			
			function v( x, y, z ) {
				
				scope.vertices.push( new THREE.Vertex( new THREE.Vector3( x, y, z ) ) );
				
			}

			function f3( a, b, c, mi ) {
				
				var material = scope.materials[ mi ];
				scope.faces.push( new THREE.Face3( a, b, c, null, material ) );
				
			}

			function f4( a, b, c, d, mi ) {
				
				var material = scope.materials[ mi ];
				scope.faces.push( new THREE.Face4( a, b, c, d, null, material ) );
				
			}

			function f3n( a, b, c, mi, na, nb, nc ) {
				
				var material = scope.materials[ mi ],
					nax = data.normals[ na*3     ],
					nay = data.normals[ na*3 + 1 ],
					naz = data.normals[ na*3 + 2 ],
				
					nbx = data.normals[ nb*3     ],
					nby = data.normals[ nb*3 + 1 ],
					nbz = data.normals[ nb*3 + 2 ],
				
					ncx = data.normals[ nc*3     ],
					ncy = data.normals[ nc*3 + 1 ],
					ncz = data.normals[ nc*3 + 2 ];
				
				scope.faces.push( new THREE.Face3( a, b, c, 
								  [new THREE.Vector3( nax, nay, naz ), new THREE.Vector3( nbx, nby, nbz ), new THREE.Vector3( ncx, ncy, ncz )], 
								  material ) );
				
			}

			function f4n( a, b, c, d, mi, na, nb, nc, nd ) {
				
				var material = scope.materials[ mi ],
					nax = data.normals[ na*3     ],
					nay = data.normals[ na*3 + 1 ],
					naz = data.normals[ na*3 + 2 ],
				
					nbx = data.normals[ nb*3     ],
					nby = data.normals[ nb*3 + 1 ],
					nbz = data.normals[ nb*3 + 2 ],
				
					ncx = data.normals[ nc*3     ],
					ncy = data.normals[ nc*3 + 1 ],
					ncz = data.normals[ nc*3 + 2 ],
				
					ndx = data.normals[ nd*3     ],
					ndy = data.normals[ nd*3 + 1 ],
					ndz = data.normals[ nd*3 + 2 ];
				
				scope.faces.push( new THREE.Face4( a, b, c, d,
								  [new THREE.Vector3( nax, nay, naz ), new THREE.Vector3( nbx, nby, nbz ), new THREE.Vector3( ncx, ncy, ncz ), new THREE.Vector3( ndx, ndy, ndz )], 
								  material ) );
				
			}

			function uv( u1, v1, u2, v2, u3, v3, u4, v4 ) {
				
				var uv = [];
				uv.push( new THREE.UV( u1, v1 ) );
				uv.push( new THREE.UV( u2, v2 ) );
				uv.push( new THREE.UV( u3, v3 ) );
				if ( u4 && v4 ) uv.push( new THREE.UV( u4, v4 ) );
				scope.uvs.push( uv );
				
			}
			
			function init_materials() {
				
				scope.materials = [];
				for( var i = 0; i < data.materials.length; ++i ) {
					scope.materials[i] = [ create_material( data.materials[i], urlbase ) ];
				}
				
			}
		
			function is_pow2( n ) {
				
				var l = Math.log(n) / Math.LN2;
				return Math.floor(l) == l;
				
			}
			
			function nearest_pow2(n) {
				
				var l = Math.log(n) / Math.LN2;
				return Math.pow( 2, Math.round(l) );
				
			}
			
			function create_material( m ) {
				
				var material, texture, image, color;
				
				if( m.map_diffuse && urlbase ) {
					
					texture = document.createElement( 'canvas' );
					material = new THREE.MeshBitmapMaterial( texture );
					
					image = new Image();
					image.onload = function () {
						
						if ( !is_pow2( this.width ) || !is_pow2( this.height ) ) {
						
							var w = nearest_pow2( this.width ),
								h = nearest_pow2( this.height );
							
							material.bitmap.width = w;
							material.bitmap.height = h;
							material.bitmap.getContext("2d").drawImage( this, 0, 0, w, h );
							
						} else {
							
							material.bitmap = this;
							
						}
						
						material.loaded = 1;
						
					};
					
					image.src = urlbase + "/" + m.map_diffuse;
					
				} else if( m.col_diffuse ) {
					
					color = (m.col_diffuse[0]*255 << 16) + (m.col_diffuse[1]*255 << 8) + m.col_diffuse[2]*255;
					material = new THREE.MeshColorFillMaterial( color, m.transparency );
					
				} else if( m.a_dbg_color ) {
					
					material = new THREE.MeshColorFillMaterial( m.a_dbg_color );
					
				} else {
					
					material = new THREE.MeshColorFillMaterial( 0xeeeeee );
					
				}

				return material;
			}
			
		}

		Model.prototype = new THREE.Geometry();
		Model.prototype.constructor = Model;
		
		callback( new Model( urlbase ) );

	}
	
};