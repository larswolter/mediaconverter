# Converting large amounts of media files
The idea of the mediaconverter is to take a directory or directory tree of media files and 
reencoding everything not matching a template.

This can be used for different things:

* To create a smaller represention of a audio library which should be transfered to a small player, reducing bitrate and channels, ccause the small audioplayer lacks playback quality and memory.
* To reencode a video library, so that specific players, like jellyfin can play them back withou reencoding
* To remove unnessary data from media files, like multiple audio/video streams

## Missing stuff
currently only reencodes with new bitrate, does not change resolution
