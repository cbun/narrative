/*


*/


(function( $, undefined ) {


    $.widget("kbaseNarrative.dataUploader", $.kbase.widget, {
        version: "1.0.0",
        options: {
            action : function (file) {
                alert("ACTION " + file);
            }
        },

        _create : function() {

            this.client = this.options.client;
        },

        makeNarrativeDataDirCallback : function (results) {
            this.listUploadedFiles();
        },

        listUploadedFiles : function () {
            this.client.list_files_async(
                this.user_id,
                '/',
                'narrative_data',
                jQuery.proxy(this.listNarrativeDataCallback, this),
                jQuery.proxy(this.errorCallback, this)
            );
        },

        viewUploadedFile: function(file) {

            this.client.get_file_async(
                this.sessionid,
                file,
                '/narrative_data',
                $.proxy(
                    function (res) {

                        try {
                            var obj = JSON.parse(res);
                            res = JSON.stringify(obj, undefined, 2);
                        }
                        catch(e) {}

                        res = res.replace(/</g, '&lt;');
                        res = res.replace(/>/g, '&gt;');

                        var boxContent = $('<div></div>')
                            .css('white-space', 'pre')
                            .css('padding', '3px')
                            .css('min-width', '400px')
                            .html(res);

                        this.data('panel').fancybox({
                            openEffect  : 'elastic',
                            closeEffect : 'elastic',
                            content : boxContent,
                        });
                        this.data('panel').trigger('click');
                    },
                    this
                ),
                function (err) { console.log("FILE FAILURE"); console.log(err) }
            );
        },

        listNarrativeDataCallback : function (res) {

            this.client.list_files_async(
                this.user_id,
                '/',
                'narrative_data',
                jQuery.proxy(
                    function (filelist) {
                        var dirs = filelist[0];
                        var files = filelist[1];

                        this.data('uploadedDataList').empty();

                        jQuery.each(
                            files,
                            jQuery.proxy(
                                function (idx, val) {
                                    this.data('uploadedDataList').append(
                                        $('<li></li>')
                                            .css('height', '18px')
                                            .css('margin-top', '1px')
                                            .css('margin-bottom', '1px')
                                            .append(
                                                $('<a></a>')
                                                    .attr('href', '#')
                                                    .attr('title', val['name'])
                                                    .text(val['name'])
                                                    .css('width', '191px')
                                                    .css('display', 'block')
                                                    .css('float', 'left')
                                                    .bind(
                                                        'click',
                                                        jQuery.proxy(
                                                            function (e) {
                                                                this.options.action(val['name']);
                                                            },
                                                            this
                                                        )
                                                    )
                                                )
                                            .append(
                                                $('<span></span>')
                                                    //.css('float', 'right')
                                                    //.css('width', '250px')
                                                    //.css("text-align", 'right')
                                                    .append(
                                                        $('<button></button>')
                                                            .attr('id', 'inspectbutton')
                                                            .append('Inspect\n')
                                                            .css({width : '19px', height : '18px'})
                                                            .button({text : false, icons : {primary : 'ui-icon-search'}})
                                                            .bind(
                                                                'click',
                                                                jQuery.proxy(
                                                                    function(e) {
                                                                        this.viewUploadedFile(val['name']);
                                                                    },
                                                                    this
                                                                )
                                                            )
                                                        )
                                                    .append(
                                                        $('<button></button>')
                                                            .attr('id', 'deletebutton')
                                                            .append('Delete\n')
                                                            .css({width : '19px', height : '18px'})
                                                            .button({text : false, icons : {primary : 'ui-icon-closethick'}})
                                                            .bind(
                                                                'click',
                                                                jQuery.proxy(
                                                                    function(e) {
                                                                        this.data('deleteFile', val['name']);
                                                                        this.$deleteDialog.dialog('open');
                                                                        e.stopPropagation();
                                                                    },
                                                                    this
                                                                )
                                                            )
                                                        )
                                                )
                                        )
                                },
                                this
                            )
                        );
                     },
                     this
                 ),
                jQuery.proxy(this.errorCallback, this)
            );

        },

        errorCallback : function (e) {
            console.log(e);
        },

        _init: function() {

            // we only use this widget if we have the client side file uploading objects
            if (window.File && window.FileReader && window.FileList && window.Blob) {

                this.appendUI( $( this.element ) );

                $(window).bind(
                    'resize',
                    $.proxy(
                        function(evt) {
                            this.reposition(evt);
                        },
                        this
                    )
                );

                this.client.make_directory_async(
                    this.user_id,
                    '/',
                    'narrative_data',
                    jQuery.proxy(this.makeNarrativeDataDirCallback, this),
                    jQuery.proxy(this.makeNarrativeDataDirCallback, this)
                );

                this.reposition();
            }

            return this;

        },

        appendUI : function($elem) {

            var $block = $('<div></div>')
                .attr('id', 'block')
                .attr('class', 'ui-widget ui-widget-content')
                .css('border-top', '0px')
                .attr('style', 'overflow : hidden; padding-bottom : 2px')
                .append(
                    $('<div></div>')
                        .append(
                            $('<div></div>')
                                .addClass("ui-widget-header")
                                .css('border-top', '0px')
                                .css('height', '30px')
                                .css('border', '0px')
                                .append(
                                    $('<h3></h3>')
                                        .attr('id', 'widget-title')
                                        .text('Uploaded data')
                                        .css('padding', '5px')
                                        .css('margin-top', '0px')
                                        .css('text-align', 'center')
                                )
                            )

                    )
                .append(
                    $('<ul></ul>')
                        .attr('id', 'uploadedDataList')
                        .css('height', '100px')
                        .css('overflow', 'scroll')
                    )
                .append(
                    $('<div></div>')
                        .css('text-align', 'right')
                        .append(
                            $('<input></input>')
                                .attr('type', 'file')
                                .attr('id', 'fileInput')
                                .css('display', 'none')
                                .button()
                        )
                        .append(
                            $('<button></button>')
                                .attr('id', 'uploadDataButton')
                                .text('Upload data')
                                .button()
                        )
                    )
                .append(
                    $('<div></div>')
                        .attr('id', 'panel')
                        .css('display', 'none')
                    )
            ;

            this._rewireIds($block, this);

            this.data('fileInput').bind('change', jQuery.proxy(this.handleFileSelect, this));

            this.data('uploadDataButton').bind(
                'click',
                jQuery.proxy(
                    function (evt) {
                        this.data('fileInput').trigger('click');
                    },
                    this
                )
            );

            this.$deleteDialog = $('<div></div>')
                .append('Really delete file?')
                .dialog(
                    {
                        title : 'Confirmation',
                        autoOpen : false,
                        modal : true,
                        resizable: false,
                        buttons : {
                            Cancel : function () {
                                $( this ).dialog('close');
                            },
                            Delete :
                                $.proxy(
                                    function() {

                                        this.$deleteDialog.dialog('close');

                                        this.client.remove_files_async(
                                            this.sessionId,
                                            '/narrative_data',
                                            this.data('deleteFile'),
                                            jQuery.proxy( function (res) { this.listUploadedFiles() }, this),
                                            this.errorCallback
                                            );


                                    },
                                    this
                                )
                        },
                        open :  function () {
                            $('button:last', $(this).parent()).focus();
                        }
                    }
                );

            //this.data('stopbutton').bind('click', $.proxy( function(evt) { this.data('gobutton').trigger('click'); evt.stopPropagation(); }, this) );
            //this.data('noticebutton').bind('click', $.proxy( function(evt) { this.data('gobutton').trigger('click'); evt.stopPropagation(); }, this) );

            $elem.append($block);

        },

        handleFileSelect : function(evt) {
            evt.stopPropagation();
            evt.preventDefault();

            var files = evt.target.files
                || evt.originalEvent.dataTransfer.files
                || evt.dataTransfer.files;

            $.each(
                files,
                jQuery.proxy(
                    function (idx, file) {

                        var reader = new FileReader();

                        reader.onload = jQuery.proxy(
                            function(e) {

                                this.client.put_file_async(
                                    this.sessionId,
                                    file.name,
                                    e.target.result,
                                    '/narrative_data',
                                    jQuery.proxy( function (res) { this.listUploadedFiles() }, this),
                                    this.errorCallback
                                );
                            },
                            this
                        );

                        reader.readAsText(file);

                    },
                    this
                )
            );

        },

        reposition : function() {

            this.data('widget-title').position({of : this.data('command-header'), my : 'center', at : 'center center'});

        }


    });

}( jQuery ) );
