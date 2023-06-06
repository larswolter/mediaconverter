# Converting large amounts of media files
The idea of the mediaconverter is to take a directory or directory tree of media files and 
reencoding everything not matching a template.

This can be used for different things:

* To create a smaller represention of a audio library which should be transfered to a small player, reducing bitrate and channels, ccause the small audioplayer lacks playback quality and memory.
* To reencode a video library, so that specific players, like jellyfin can play them back withou reencoding
* To remove unnessary data from media files, like multiple audio/video streams

## Missing stuff
currently only reencodes with new bitrate, does not change resolution

## Usage

Requires Node (18) and ffmpeg installed. After checking out the repo 

```shell
npm install
```

analyze videos, grouping them together to show resolutions and bitrates
```shell
npm start -- analyze /home/user/Videos
```

convert vieos that dont match the `config/videos.json` template
```shell
npm start -- copy /home/user/Videos ./convertedVideos
```

convert some mp3 folder audiobooks to .m4b audiobooks
```shell
npm start -- audiobook /home/user/Audiobooks ./convertedBooks
```
