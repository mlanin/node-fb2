var Fb2Generator = function Fb2Generator () {
    var Book,
        allChapters  = [],
        fs           = require('fs'),
        base64Stream = require('base64stream'),
        XML          = require('libxmljs'),

        uuid         = 'urn:uuid:' + require('node-uuid').v4(),
        nameSpace    = {
            fb : 'http://www.gribuser.ru/xml/fictionbook/2.0'
        },
        mime         = 'application/x-fictionbook';

    function readFile (file, type, callback) {
        fs.readFile(__dirname + '/../..' + file, function(err, content) {
            if (err) return callback(err);
            callback(null, content.toString(type));
        });
    }

    function addFile (file, callback) {
        var data   = '';
        var stream = new base64Stream.BufferedStreamToBase64();

        stream.on('data', function(chunk){
            data += chunk;
        }).on('end', function() {
            // Update Book xml
            Book.root().node('binary', data).attr({'id': file.filename, 'content-type' : mimeFromName(file.filename)});
            callback(null);
        }).on('error', callback);

        // Write stream
        file.stream.pipe(stream);
    }

    function idFromName (name) {
        return name.replace(/[^A-Za-z]/, '')+(new Date()).getTime();
    }

    function mimeFromName (name) {
        switch (name.split('.').pop()) {
            case 'ncx':
                return 'application/x-dtbncx+xml';
            case 'xml':
                return 'application/xhtml+xml';
            case 'html':
                return 'application/xhtml+xml';
            case 'xhtml':
                return 'application/xhtml+xml';
            case 'jpg':
                return 'image/jpeg';
            case 'jpeg':
                return 'image/jpeg';
            case 'gif':
                return 'image/gif';
            case 'png':
                return 'image/png';
            case 'svg':
                return 'application/svg+xml';
            case 'ttf':
                return 'application/x-opentype-font';
            case 'js':
                return 'text/javascript';
            case 'css':
                return 'text/css';
            case 'txt':
                return 'text/plain';
            default:
                return 'application/octet-stream';
        }
    }

    function prepareChapter (chapter) {
        chapter = chapter.replace(/<br>/g, '<br/>');
        chapter = XML.parseXmlString(chapter);

        chapter.find('//a').forEach(function(link) {
            var attrs = {
                'type' : 'note',
                'xlink:href' : link.attr('href').value()
            }
            link.attr('href').remove();
            link.attr('data-note-key').remove();

            link.attr(attrs);
        });
        return chapter.get('//section');
    }

    return {
        prepare : function prepare (next) {
            readFile('/libs/fb2/fb2.xml', 'utf8', function(err, content) {
                if (err) next(err);
                Book = XML.parseXmlString(content);

                next();
            });
        },

        title : function title (title, next) {
            // Update Book xml
            Book.get('//fb:title-info', nameSpace).node('book-title', title);

            Book.get('//fb:body', nameSpace)
                .node('title')
                    .node('p', title)
                .parent();

            next();
        },

        cover : function cover (cover, next) {
            if (!cover) {
                return;
            }

            // Add file
            var Model = require('../../models/book').Book(mongoDb),
                book = new Model();

            book.getCover(cover, function(error, file) {
                if (error) {
                    return next(error);
                } else {
                    // Update Book xml
                    Book.get('//fb:title-info', nameSpace)
                        .node('coverpage')
                            .node('image').attr({'xlink:href' : '#' + file.filename})
                        .parent();

                    addFile(file, next);
                }
            });
        },

        author : function author (author, next) {
            author = 'John Doe';

            var parts = author.split(' ');

            // Update Book xml
            Book.get('//fb:title-info', nameSpace)
                .node('author')
                    .node('first-name', parts[0] || '')
                .parent()
                    .node('second-name', parts[1] || '')
                .parent();

            next();
        },

        language : function language (language, next) {
            language = language || 'en';

            // Update <lang>
            Book.get('//fb:title-info', nameSpace).node('lang', language);

            next();
        },

        date : function date (date, next) {
            // Update <title-info>
            Book.get('//fb:title-info', nameSpace).node('date', date()).attr({value : date()});

           // Update <document-info>
            Book.get('//fb:document-info', nameSpace).node('date', date()).attr({value : date()});

            next();
        },

        content : function content (chapters, next) {
            var body = Book.get('//fb:body[1]', nameSpace);

            // Traverse through all chapters and add each of them to the book
            for (var i in chapters) {
                var id = i - 0 + 1;
                var content = prepareChapter('<?xml version="1.0" encoding="UTF-8"?>\n\
    <root>\n\
        <section id="chapter_' + id + '"><title><p>' + chapters[i].title + '</p></title>' + chapters[i].content + '</section>\n\
    </root>');
                body.addChild(content);
            }

            next();
        },

        css : function css (css, next) {
            // Update Book xml
            //book.get('//fb', nameSpace).node('stylesheet', css).attr({type : 'text/css'});
            next();
        },

        images : function images (images, next) {
            // Traverse through all chapters and add each of them to the book
            for (var i in images) {
                this.addImage(images[i]);
            }

            next();
        },

        addImage : function addImage (image, next) {
            readFile('/public/uploads/' + image, 'base64', function(err, content) {
                if (err) next(err);
                // Add file
                addFile(image, content);
                next();
            });
        },

        notes : function notes (notes, next) {
            var notesBodyNode = new XML.Document().node('body').attr({name : 'notes'})
                .node('title')
                    .node('p', 'Notes')
                .parent()
            .parent();

            // Traverse through all chapters and add each of them to the book
            for (var i in notes) {
                var id = i - 0 + 1;

                // Update Book xml
                notesBodyNode
                    .node('section').attr({id : 'note_' + id})
                        .node('title')
                            .node('p', notes[i].title)
                        .parent()
                    .parent()
                        .node('p', notes[i].content)
                    .parent()
                .parent();
            }

            Book.get('//fb:body[1]', nameSpace).addNextSibling(notesBodyNode);

            next();
        },

        getMime : function getMime () {
            return mime;
        },

        finalize : function finalize () {
            // Update Book xml
            Book.get('//fb:document-info', nameSpace).node('id', uuid);

            return Book.toString().replace(/<chapters_node\/>/g, allChapters);
        }
    }
}

module.exports = Fb2Generator;