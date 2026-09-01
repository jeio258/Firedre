export type SakuraConfig = {
	enable: boolean;            
	sakuraNum: number;             
	limitTimes: number;                    
	size: {
		min: number;            
		max: number;            
	};
	opacity: {
		min: number;            
		max: number;            
	};
	speed: {
		horizontal: {
			min: number;             
			max: number;             
		};
		vertical: {
			min: number;             
			max: number;             
		};
		rotation: number;        
		fadeSpeed: number;                   
	};
	zIndex: number; // 层级，确保樱花在合适的层级显示
};
