@echo off
echo 正在清理 output 中的 HTML 文件...
del /q ".\output\*.html"

echo 正在清理 output\assets\visual 中的图片文件...
del /q ".\output\assets\visual\*.*"

echo 正在清理 screenshots 中的图片文件...
del /q ".\screenshots\*.*"

echo 正在清理根目录下的 docx 文档...
del /q ".\*.docx"

echo 清理完成。
exit