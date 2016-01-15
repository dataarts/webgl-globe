<?php

$string = file_get_contents("latlng.php");

//var_dump($string);

$arr = explode("\n", $string);


var_dump($arr);

$ret = "";
foreach($arr as $v){
	if($v != ''){
		$latlng = explode(",", $v);
		//$ret .= ','.$latlng[0].','. $latlng[1]. ',0.1';
		$ret .= $latlng[1].'<br/>';
	}
}

var_dump($ret);
