import { ColorSwatch, Group } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import Draggable from 'react-draggable';
import { SWATCHES } from '@/constants';
import { Pencil, Eraser, Square, Circle, Minus } from 'lucide-react';

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

type Tool = 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line';

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('rgb(255, 255, 255)');
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState({});
    const [result, setResult] = useState<GeneratedResult>();
    const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
    const [latexExpression, setLatexExpression] = useState<Array<string>>([]);
    const [selectedTool, setSelectedTool] = useState<Tool>('pen');
    const [lineWidth, setLineWidth] = useState(3);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (latexExpression.length > 0 && window.MathJax) {
            setTimeout(() => {
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
            }, 0);
        }
    }, [latexExpression]);

    useEffect(() => {
        if (result) {
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result]);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setResult(undefined);
            setDictOfVars({});
            setReset(false);
        }
    }, [reset]);

    useEffect(() => {
        const canvas = canvasRef.current;
    
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight - canvas.offsetTop;
                ctx.lineCap = 'round';
                ctx.lineWidth = lineWidth;
            }
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML';
        script.async = true;
        document.head.appendChild(script);

        script.onload = () => {
            window.MathJax.Hub.Config({
                tex2jax: {inlineMath: [['$', '$'], ['\\(', '\\)']]},
            });
        };

        return () => {
            document.head.removeChild(script);
        };
    }, []);

    const renderLatexToCanvas = (expression: string, answer: string) => {
        const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
        setLatexExpression([...latexExpression, latex]);

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const drawShape = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || !isDrawing) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const currentPos = {
            x: e.nativeEvent.offsetX,
            y: e.nativeEvent.offsetY
        };

        ctx.strokeStyle = selectedTool === 'eraser' ? '#000000' : color;
        ctx.lineWidth = selectedTool === 'eraser' ? 20 : lineWidth;

        switch (selectedTool) {
            case 'rectangle':
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();
                ctx.rect(
                    startPos.x,
                    startPos.y,
                    currentPos.x - startPos.x,
                    currentPos.y - startPos.y
                );
                ctx.stroke();
                break;
            case 'circle':
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();
                const radius = Math.sqrt(
                    Math.pow(currentPos.x - startPos.x, 2) +
                    Math.pow(currentPos.y - startPos.y, 2)
                );
                ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
                ctx.stroke();
                break;
            case 'line':
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();
                ctx.moveTo(startPos.x, startPos.y);
                ctx.lineTo(currentPos.x, currentPos.y);
                ctx.stroke();
                break;
            default:
                ctx.lineTo(currentPos.x, currentPos.y);
                ctx.stroke();
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.style.background = 'black';
            const ctx = canvas.getContext('2d');
            if (ctx) {
                setStartPos({
                    x: e.nativeEvent.offsetX,
                    y: e.nativeEvent.offsetY
                });
                ctx.beginPath();
                ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                setIsDrawing(true);
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        drawShape(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };  

    const runRoute = async () => {
        const canvas = canvasRef.current;
    
        if (canvas) {
            const response = await axios({
                method: 'post',
                url: `${import.meta.env.VITE_API_URL}/calculate`,
                data: {
                    image: canvas.toDataURL('image/png'),
                    dict_of_vars: dictOfVars
                }
            });

            const resp = await response.data;
            console.log('Response', resp);
            resp.data.forEach((data: Response) => {
                if (data.assign === true) {
                    setDictOfVars({
                        ...dictOfVars,
                        [data.expr]: data.result
                    });
                }
            });
            const ctx = canvas.getContext('2d');
            const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
            let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x++) {
                    const i = (y * canvas.width + x) * 4;
                    if (imageData.data[i + 3] > 0) {
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                }
            }

            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            setLatexPosition({ x: centerX, y: centerY });
            resp.data.forEach((data: Response) => {
                setTimeout(() => {
                    setResult({
                        expression: data.expr,
                        answer: data.result
                    });
                }, 1000);
            });
        }
    };

    return (
        <>
            <div className='fixed top-0 left-0 right-0 bg-white shadow-md p-4 z-50'>
                <div className='max-w-7xl mx-auto grid grid-cols-3 gap-4'>
                    <div className='flex items-center gap-2'>
                        <Button
                            onClick={() => setReset(true)}
                            variant='outline'
                            className='w-24'
                        >
                            Reset
                        </Button>
                        <Button
                            onClick={() => setSelectedTool('pen')}
                            variant={selectedTool === 'pen' ? 'default' : 'outline'}
                            size="icon"
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            onClick={() => setSelectedTool('eraser')}
                            variant={selectedTool === 'eraser' ? 'default' : 'outline'}
                            size="icon"
                        >
                            <Eraser className="h-4 w-4" />
                        </Button>
                        <Button
                            onClick={() => setSelectedTool('rectangle')}
                            variant={selectedTool === 'rectangle' ? 'default' : 'outline'}
                            size="icon"
                        >
                            <Square className="h-4 w-4" />
                        </Button>
                        <Button
                            onClick={() => setSelectedTool('circle')}
                            variant={selectedTool === 'circle' ? 'default' : 'outline'}
                            size="icon"
                        >
                            <Circle className="h-4 w-4" />
                        </Button>
                        <Button
                            onClick={() => setSelectedTool('line')}
                            variant={selectedTool === 'line' ? 'default' : 'outline'}
                            size="icon"
                        >
                            <Minus className="h-4 w-4" />
                        </Button>
                    </div>
                    <Group className='justify-center'>
                        {SWATCHES.map((swatch) => (
                            <ColorSwatch 
                                key={swatch} 
                                color={swatch} 
                                onClick={() => setColor(swatch)}
                                className={`cursor-pointer ${color === swatch ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                            />
                        ))}
                    </Group>
                    <div className='flex justify-end'>
                        <Button
                            onClick={runRoute}
                            variant='default'
                            className='w-24'
                        >
                            Run
                        </Button>
                    </div>
                </div>
            </div>
            <div className='pt-20'>
                <canvas
                    ref={canvasRef}
                    id='canvas'
                    className='absolute top-0 left-0 w-full h-full'
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                />

                {latexExpression && latexExpression.map((latex, index) => (
                    <Draggable
                        key={index}
                        defaultPosition={latexPosition}
                        onStop={(e, data) => setLatexPosition({ x: data.x, y: data.y })}
                    >
                        <div className="absolute p-2 text-white rounded shadow-md">
                            <div className="latex-content">{latex}</div>
                        </div>
                    </Draggable>
                ))}
            </div>
        </>
    );
}